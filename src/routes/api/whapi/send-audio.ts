import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const MAX_BYTES = 16 * 1024 * 1024; // 16 MB

const WHATSAPP_CHAT_ID_RE = /^(?:\d{7,18}|\d{7,18}@s\.whatsapp\.net|\d{10,18}@g\.us|\d{10,18}@newsletter|\d{7,18}@lid)$/;

function extFromMime(mime: string): string {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("mpeg")) return "mp3";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  return "bin";
}

function getWhapiErrorMessage(bodyText: string, bodyJson: any): string {
  const err = bodyJson?.error;
  if (typeof bodyJson?.message === "string") return bodyJson.message;
  if (typeof err?.message === "string") return err.message;
  if (typeof err === "string") return err;
  if (typeof bodyJson?.detail === "string") return bodyJson.detail;
  return bodyText.slice(0, 300) || "Erro desconhecido";
}

function mapWhapiStatus(status: number): number {
  // Avoid returning 5xx for handled upstream validation/auth responses because the
  // preview treats server 5xx from route handlers as runtime failures. These are
  // actionable configuration/recipient errors for the current workspace.
  if ([400, 401, 402, 403, 404, 413, 415, 429].includes(status)) return status;
  return 424;
}

export const Route = createFileRoute("/api/whapi/send-audio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            return jsonResponse({ error: "Não autenticado" }, 401);
          }
          const token = authHeader.slice(7);
          const SUPABASE_URL = process.env.SUPABASE_URL;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
          if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
            return jsonResponse({ error: "Servidor mal configurado" }, 500);
          }

          const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          });

          const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
          if (claimsError || !claimsData?.claims?.sub) {
            return jsonResponse({ error: "Token inválido" }, 401);
          }
          const userId = claimsData.claims.sub as string;

          const form = await request.formData();
          const conversationId = form.get("conversationId");
          const file = form.get("file");
          if (typeof conversationId !== "string" || !(file instanceof Blob)) {
            return jsonResponse({ error: "Dados inválidos" }, 400);
          }
          if (file.size === 0) {
            return jsonResponse({ error: "Áudio vazio" }, 400);
          }
          if (file.size > MAX_BYTES) {
            return jsonResponse({ error: "Áudio muito grande (máx 16 MB)" }, 413);
          }
          const mime = file.type || "audio/webm";

          // Load conversation via user RLS
          const { data: conv, error: convErr } = await userClient
            .from("conversations")
            .select("id, workspace_id, external_id")
            .eq("id", conversationId)
            .maybeSingle();
          if (convErr) return jsonResponse({ error: "Erro ao buscar conversa" }, 500);
          if (!conv) return jsonResponse({ error: "Conversa não encontrada" }, 404);
          const to = String(conv.external_id || "").trim();
          if (!to) {
            return jsonResponse({ error: "Conversa sem chat_id externo" }, 400);
          }
          // Conversas de teste (external_id começando com "test-") pulam o envio
          // real para o Whapi e apenas salvam a mensagem localmente, permitindo
          // visualizar como o áudio aparece na UI.
          const isTestConversation = to.startsWith("test-");
          if (!isTestConversation && !WHATSAPP_CHAT_ID_RE.test(to)) {
            return jsonResponse(
              {
                error:
                  "Esta conversa não possui um chat_id válido do WhatsApp. Use um número real com DDI/DDD, por exemplo 5511999999999.",
              },
              400,
            );
          }

          // Load Whapi integration (admin)
          const { data: integration, error: integErr } = await supabaseAdmin
            .from("workspace_integrations")
            .select("api_url, token, enabled")
            .eq("workspace_id", conv.workspace_id)
            .eq("provider", "whapi")
            .maybeSingle();
          if (integErr) return jsonResponse({ error: "Erro ao buscar integração" }, 500);
          if (!integration || !integration.enabled || !integration.token) {
            return jsonResponse({ error: "Integração Whapi não configurada" }, 400);
          }
          if (!integration.api_url) {
            return jsonResponse({ error: "URL da integração Whapi não configurada" }, 400);
          }

          // Upload to Storage
          const ext = extFromMime(mime);
          const objectPath = `audio/${conv.id}/${crypto.randomUUID()}.${ext}`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("chat-media")
            .upload(objectPath, file, { contentType: mime, upsert: false });
          if (upErr) {
            console.error("send-audio upload error", upErr);
            return jsonResponse({ error: "Falha ao salvar áudio" }, 500);
          }

          // Signed URL for Whapi to fetch (1h)
          const { data: signed, error: signErr } = await supabaseAdmin.storage
            .from("chat-media")
            .createSignedUrl(objectPath, 60 * 60);
          if (signErr || !signed?.signedUrl) {
            return jsonResponse({ error: "Falha ao gerar URL de áudio" }, 500);
          }

          // Sender name
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("name")
            .eq("id", userId)
            .maybeSingle();
          const senderName = prof?.name || "Agent";

          // Send to Whapi /messages/voice
          const apiUrl = integration.api_url.replace(/\/$/, "");
          const whapiUrl = `${apiUrl}/messages/voice`;
          console.log("🎤 [whapi/send-audio] Enviando áudio para Whapi", {
            to,
            url: whapiUrl,
            mime,
            bytes: file.size,
          });
          let whapiRes: Response;
          try {
            whapiRes = await fetch(whapiUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${integration.token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ to, media: signed.signedUrl }),
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("🎤 [whapi/send-audio] Falha de rede ao chamar Whapi:", msg);
            return jsonResponse({ error: `Falha de rede ao contatar Whapi: ${msg}` }, 424);
          }

          const whapiText = await whapiRes.text();
          let whapiJson: any = null;
          try {
            whapiJson = whapiText ? JSON.parse(whapiText) : null;
          } catch {
            /* not JSON */
          }
          if (!whapiRes.ok) {
            console.error("🎤 [whapi/send-audio] Whapi retornou erro:", {
              status: whapiRes.status,
              body: whapiText.slice(0, 1000),
            });
            const apiErrMsg = getWhapiErrorMessage(whapiText, whapiJson);
            return jsonResponse(
              { error: `Whapi retornou ${whapiRes.status}: ${apiErrMsg}` },
              mapWhapiStatus(whapiRes.status),
            );
          }

          console.log("🎤 [whapi/send-audio] ✅ Whapi aceitou o áudio");

          const externalId: string | null =
            whapiJson?.message?.id || whapiJson?.id || null;

          // Insert message row
          const { data: inserted, error: insertErr } = await supabaseAdmin
            .from("messages")
            .insert({
              conversation_id: conv.id,
              content: "",
              from_me: true,
              sender_name: senderName,
              external_id: externalId,
              media_url: signed.signedUrl,
              media_type: "audio",
              media_mime_type: mime,
            })
            .select("id, conversation_id, content, from_me, sender_name, created_at, media_url, media_type, media_mime_type")
            .single();

          if (insertErr) {
            if ((insertErr as any).code === "23505") {
              return jsonResponse({ ok: true, deduped: true });
            }
            console.error("send-audio insert error", insertErr);
            return jsonResponse({ error: "Áudio enviado mas não salvo localmente" }, 500);
          }

          await supabaseAdmin
            .from("conversations")
            .update({
              last_message: "🎤 Mensagem de voz",
              last_message_at: inserted.created_at,
            })
            .eq("id", conv.id);

          return jsonResponse({
            ok: true,
            message: {
              id: inserted.id,
              conversationId: inserted.conversation_id,
              content: inserted.content,
              fromMe: inserted.from_me,
              senderName: inserted.sender_name,
              createdAt: inserted.created_at,
              mediaUrl: inserted.media_url,
              mediaType: inserted.media_type,
              mediaMimeType: inserted.media_mime_type,
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("send-audio error", msg);
          return jsonResponse({ error: msg }, 500);
        }
      },
    },
  },
});
