import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const BodySchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4096),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/whapi/send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log("📤 [whapi/send] Recebida requisição de envio");
        try {
          // ----- Auth -----
          const authHeader = request.headers.get("authorization");
          if (!authHeader?.startsWith("Bearer ")) {
            console.warn("📤 [whapi/send] Sem header Authorization");
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
            console.warn("📤 [whapi/send] Token inválido", claimsError?.message);
            return jsonResponse({ error: "Token inválido" }, 401);
          }
          const userId = claimsData.claims.sub as string;

          // ----- Validate body -----
          const rawBody = await request.json();
          const parsed = BodySchema.safeParse(rawBody);
          if (!parsed.success) {
            return jsonResponse({ error: "Dados inválidos", details: parsed.error.flatten() }, 400);
          }
          const { conversationId, content } = parsed.data;

          // ----- Load conversation (RLS as user) -----
          const { data: conv, error: convErr } = await userClient
            .from("conversations")
            .select("id, workspace_id, external_id, type")
            .eq("id", conversationId)
            .maybeSingle();

          if (convErr) {
            console.error("📤 [whapi/send] Erro buscando conversa:", convErr.message);
            return jsonResponse({ error: "Erro ao buscar conversa" }, 500);
          }
          if (!conv) {
            return jsonResponse({ error: "Conversa não encontrada ou sem acesso" }, 404);
          }
          if (!conv.external_id) {
            return jsonResponse(
              { error: "Esta conversa não possui chat_id externo do WhatsApp" },
              400,
            );
          }

          // ----- Load Whapi integration (admin client - token is admin-only) -----
          const { data: integration, error: integErr } = await supabaseAdmin
            .from("workspace_integrations")
            .select("api_url, token, enabled, provider")
            .eq("workspace_id", conv.workspace_id)
            .eq("provider", "whapi")
            .maybeSingle();

          if (integErr) {
            console.error("📤 [whapi/send] Erro buscando integração:", integErr.message);
            return jsonResponse({ error: "Erro ao buscar integração" }, 500);
          }
          if (!integration || !integration.enabled) {
            return jsonResponse({ error: "Integração Whapi desativada para este workspace" }, 400);
          }
          if (!integration.token) {
            return jsonResponse({ error: "Token do Whapi não configurado" }, 400);
          }

          // ----- Sender name + signature from profile -----
          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("name, signature")
            .eq("id", userId)
            .maybeSingle();
          const senderName = prof?.name || "Agent";
          const customSignature = (prof?.signature ?? "").trim();

          // Prefix every outgoing message with the agent signature so both the
          // recipient (on WhatsApp) and the local panel see who sent it.
          // Users can customize their signature in Settings; falls back to name.
          const signedContent = customSignature
            ? `${customSignature}\n${content}`
            : `*${senderName}:*\n${content}`;

          // ----- Send to Whapi -----
          const apiUrl = integration.api_url.replace(/\/$/, "");
          const whapiUrl = `${apiUrl}/messages/text`;
          console.log("📤 [whapi/send] Enviando para Whapi:", { to: conv.external_id, url: whapiUrl });

          let whapiRes: Response;
          try {
            whapiRes = await fetch(whapiUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${integration.token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              body: JSON.stringify({ to: conv.external_id, body: signedContent }),
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.error("📤 [whapi/send] Falha de rede ao chamar Whapi:", msg);
            return jsonResponse({ error: `Falha de rede ao contatar Whapi: ${msg}` }, 502);
          }

          const whapiText = await whapiRes.text();
          let whapiJson: any = null;
          try {
            whapiJson = whapiText ? JSON.parse(whapiText) : null;
          } catch {
            // not JSON
          }

          if (!whapiRes.ok) {
            console.error("📤 [whapi/send] Whapi retornou erro:", {
              status: whapiRes.status,
              body: whapiText.slice(0, 500),
            });
            const apiErrMsg =
              whapiJson?.message || whapiJson?.error?.message || whapiText.slice(0, 200) || "Erro desconhecido";
            return jsonResponse(
              { error: `Whapi retornou ${whapiRes.status}: ${apiErrMsg}` },
              502,
            );
          }

          console.log("📤 [whapi/send] ✅ Whapi aceitou a mensagem");
          const externalId: string | null =
            whapiJson?.message?.id || whapiJson?.id || null;
          const senderPhone: string | null =
            whapiJson?.message?.from || whapiJson?.from || null;

          // ----- Insert message (admin to bypass RLS races; conversation already validated) -----
          const insertPayload: Database["public"]["Tables"]["messages"]["Insert"] = {
            conversation_id: conversationId,
            content: signedContent,
            from_me: true,
            sender_name: senderName,
            external_id: externalId,
            sender_phone: senderPhone,
          };

          const { data: inserted, error: insertErr } = await supabaseAdmin
            .from("messages")
            .insert(insertPayload)
            .select("id, conversation_id, content, from_me, sender_name, created_at")
            .single();

          if (insertErr) {
            // 23505 = unique violation (webhook may have echoed faster)
            if ((insertErr as any).code === "23505") {
              console.log("📤 [whapi/send] Mensagem já existia (eco do webhook)");
              return jsonResponse({ ok: true, deduped: true });
            }
            console.error("📤 [whapi/send] Erro inserindo mensagem:", insertErr.message);
            return jsonResponse({ error: "Mensagem enviada mas não salva localmente" }, 500);
          }

          // ----- Bump conversation last message -----
          await supabaseAdmin
            .from("conversations")
            .update({
              last_message: signedContent,
              last_message_at: inserted.created_at,
            })
            .eq("id", conversationId);

          console.log("📤 [whapi/send] ✅ Fluxo completo, message_id:", inserted.id);

          return jsonResponse({
            ok: true,
            message: {
              id: inserted.id,
              conversationId: inserted.conversation_id,
              content: inserted.content,
              fromMe: inserted.from_me,
              senderName: inserted.sender_name,
              createdAt: inserted.created_at,
              type: "text",
            },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("📤 [whapi/send] Erro inesperado:", msg);
          return jsonResponse({ error: msg }, 500);
        }
      },
    },
  },
});
