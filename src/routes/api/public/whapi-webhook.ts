import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/whapi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          console.error("[whapi-webhook] invalid JSON body");
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        console.log("[whapi-webhook] payload received", {
          hasMessages: Array.isArray(payload?.messages),
          count: payload?.messages?.length ?? 0,
        });

        const messages: any[] = Array.isArray(payload?.messages) ? payload.messages : [];
        if (messages.length === 0) {
          return json({ ok: true, ignored: "no_messages" });
        }

        // Auth: derive workspace from any message's account number
        // Whapi typically includes either the account phone or we can match by chat owner.
        // We try several candidate fields and normalize.
        const providedSecret =
          request.headers.get("x-webhook-secret") ||
          request.headers.get("x-whapi-secret") ||
          new URL(request.url).searchParams.get("secret") ||
          undefined;

        let processed = 0;
        let skipped = 0;

        for (const msg of messages) {
          try {
            const chatId: string | undefined = msg?.chat_id || msg?.from || msg?.to;
            if (!chatId) {
              skipped++;
              continue;
            }

            const fromMe: boolean = Boolean(msg?.from_me);
            // Account/connected number candidates
            const accountNumberRaw: string | undefined =
              payload?.channel_id ||
              payload?.account ||
              payload?.account_phone ||
              msg?.device_phone ||
              (fromMe ? msg?.from : msg?.to);

            const accountDigits = digitsOnly(accountNumberRaw);
            const contactDigits = digitsOnly(fromMe ? chatId : msg?.from || chatId);
            const isGroup = String(chatId).includes("@g.us");

            // Find workspace by whatsapp_number (suffix match to be tolerant of formatting)
            const workspace = await findWorkspaceByNumber(accountDigits);
            if (!workspace) {
              console.warn("[whapi-webhook] workspace not found for number", {
                accountDigits,
                chatId,
              });
              skipped++;
              continue;
            }

            // Validate webhook secret if configured for this workspace
            const { data: integ } = await supabaseAdmin
              .from("workspace_integrations")
              .select("webhook_secret, enabled")
              .eq("workspace_id", workspace.id)
              .eq("provider", "whapi")
              .maybeSingle();

            if (integ?.webhook_secret) {
              if (providedSecret !== integ.webhook_secret) {
                console.warn("[whapi-webhook] invalid secret", { workspace: workspace.id });
                return json({ ok: false, error: "invalid_secret" }, 401);
              }
            }
            if (integ && integ.enabled === false) {
              skipped++;
              continue;
            }

            const senderName: string =
              msg?.from_name || msg?.chat_name || (isGroup ? "Grupo" : "Contato");
            const content: string =
              msg?.text?.body ||
              msg?.caption ||
              msg?.image?.caption ||
              `[${msg?.type || "mensagem"}]`;
            const externalMsgId: string | undefined = msg?.id;

            // Find or create conversation by (workspace_id, external_id=chatId)
            const conversationId = await upsertConversation({
              workspaceId: workspace.id,
              externalId: chatId,
              isGroup,
              name: senderName,
            });

            // Insert message; rely on unique index on external_id to dedupe
            const { error: insertErr } = await supabaseAdmin.from("messages").insert({
              conversation_id: conversationId,
              content,
              from_me: fromMe,
              sender_name: senderName,
              sender_phone: contactDigits || null,
              external_id: externalMsgId ?? null,
            });

            if (insertErr) {
              if (insertErr.code === "23505") {
                // duplicate, ignore
                skipped++;
                continue;
              }
              console.error("[whapi-webhook] insert message error", insertErr);
              skipped++;
              continue;
            }

            await supabaseAdmin
              .from("conversations")
              .update({
                last_message: content,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversationId);

            processed++;
            console.log("[whapi-webhook] message saved", {
              workspace: workspace.id,
              conversationId,
              externalMsgId,
            });
          } catch (e) {
            console.error("[whapi-webhook] error processing message", e);
            skipped++;
          }
        }

        return json({ ok: true, processed, skipped });
      },
    },
  },
});

function digitsOnly(v: unknown): string {
  if (!v) return "";
  return String(v).replace(/\D+/g, "");
}

async function findWorkspaceByNumber(digits: string) {
  if (!digits) return null;
  // Try exact match first, then suffix match (last 10-13 digits)
  const { data: exact } = await supabaseAdmin
    .from("workspaces")
    .select("id, whatsapp_number")
    .eq("whatsapp_number", digits)
    .maybeSingle();
  if (exact) return exact;

  const { data: all } = await supabaseAdmin
    .from("workspaces")
    .select("id, whatsapp_number")
    .not("whatsapp_number", "is", null);
  if (!all) return null;
  return (
    all.find((w) => {
      const wd = digitsOnly(w.whatsapp_number);
      if (!wd) return false;
      return wd === digits || wd.endsWith(digits) || digits.endsWith(wd);
    }) ?? null
  );
}

async function upsertConversation(params: {
  workspaceId: string;
  externalId: string;
  isGroup: boolean;
  name: string;
}) {
  const { workspaceId, externalId, isGroup, name } = params;
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      workspace_id: workspaceId,
      external_id: externalId,
      type: isGroup ? "GROUP" : "PRIVATE",
      name,
      last_message: "",
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
