import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/whapi-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        console.log("🔥 WEBHOOK RECEBIDO");
        console.log("METHOD:", request.method);
        console.log("URL:", request.url);
        try {
          const safeHeaders = Object.fromEntries(request.headers.entries());
          // mask sensitive headers
          if (safeHeaders["x-webhook-secret"]) safeHeaders["x-webhook-secret"] = "***";
          if (safeHeaders["x-whapi-secret"]) safeHeaders["x-whapi-secret"] = "***";
          if (safeHeaders["authorization"]) safeHeaders["authorization"] = "***";
          console.log("HEADERS:", safeHeaders);
        } catch (e) {
          console.log("⚠️ não foi possível serializar headers", e);
        }

        const rawBody = await request.text();
        let payload: any;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          console.error("❌ [whapi-webhook] invalid JSON body");
          console.log("RAW BODY:", rawBody);
          return json({ ok: false, error: "invalid_json" }, 400);
        }

        console.log("📦 PAYLOAD COMPLETO:");
        try {
          console.log(JSON.stringify(payload, null, 2));
        } catch {
          console.log(payload);
        }

        if (!Array.isArray(payload?.messages)) {
          console.log("❌ Payload sem 'messages' (ou não é array)");
          return json({ ok: true, ignored: "no_messages_field" });
        }

        const messages: any[] = payload.messages;
        console.log(`📨 Total de mensagens no payload: ${messages.length}`);

        if (messages.length === 0) {
          console.log("ℹ️ Nenhuma mensagem para processar");
          return json({ ok: true, ignored: "no_messages" });
        }

        const providedSecret =
          request.headers.get("x-webhook-secret") ||
          request.headers.get("x-whapi-secret") ||
          new URL(request.url).searchParams.get("secret") ||
          undefined;
        console.log("🔐 Secret fornecido:", providedSecret ? "sim" : "não");

        let processed = 0;
        let skipped = 0;

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          console.log(`\n──────── Mensagem [${i + 1}/${messages.length}] ────────`);
          try {
            console.log("📩 MENSAGEM EXTRAÍDA:");
            console.log(msg);

            console.log("ID:", msg?.id);
            console.log("CHAT_ID:", msg?.chat_id);
            console.log("FROM_ME:", msg?.from_me);
            console.log("TYPE:", msg?.type);
            console.log("TEXT:", msg?.text?.body);

            const chatId: string | undefined = msg?.chat_id || msg?.from || msg?.to;
            if (!chatId) {
              console.log("⚠️ Sem chat_id/from/to — pulando");
              skipped++;
              continue;
            }

            const fromMe: boolean = Boolean(msg?.from_me);
            const accountCandidate = firstPhoneCandidate([
              payload?.account_phone,
              payload?.phone_number,
              payload?.phone,
              payload?.channel?.phone_number,
              payload?.channel?.phone,
              payload?.instance?.phone_number,
              payload?.instance?.phone,
              msg?.device_phone,
              msg?.to,
              fromMe ? msg?.from : undefined,
            ]);
            const accountNumberRaw = accountCandidate?.raw || payload?.channel_id;
            const accountDigits = accountCandidate?.digits ?? "";
            const contactDigits = digitsOnly(fromMe ? chatId : msg?.from || chatId);
            const isGroup = String(chatId).includes("@g.us");

            console.log("🔍 Buscando workspace pelo número...", {
              accountNumberRaw,
              accountDigits,
              contactDigits,
              isGroup,
            });

            let workspace = await findWorkspaceByNumber(accountDigits);
            if (!workspace) {
              workspace = await findSingleEnabledWhapiWorkspace();
            }
            if (!workspace) {
              console.log("❌ Nenhum workspace encontrado para o número:", accountDigits, "(chat_id:", chatId, ")");
              skipped++;
              continue;
            }
            console.log("🏢 WORKSPACE ENCONTRADO:", workspace);

            const { data: integ, error: integErr } = await supabaseAdmin
              .from("workspace_integrations")
              .select("webhook_secret, enabled")
              .eq("workspace_id", workspace.id)
              .eq("provider", "whapi")
              .maybeSingle();

            if (integErr) {
              console.log("⚠️ Erro ao carregar integração:", integErr);
            }
            console.log("⚙️ Integração:", {
              hasSecret: Boolean(integ?.webhook_secret),
              enabled: integ?.enabled,
            });

            if (integ?.webhook_secret) {
              if (providedSecret !== integ.webhook_secret) {
                console.log("❌ Secret inválido para workspace:", workspace.id);
                return json({ ok: false, error: "invalid_secret" }, 401);
              }
              console.log("✅ Secret validado");
            }
            if (integ && integ.enabled === false) {
              console.log("⏭️ Integração desabilitada — pulando");
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

            console.log("🔎 Buscando conversa...", { workspaceId: workspace.id, externalId: chatId });
            const conversationId = await upsertConversation({
              workspaceId: workspace.id,
              externalId: chatId,
              isGroup,
              name: senderName,
            });
            console.log("💬 CONVERSA:", { id: conversationId });

            console.log("💾 Salvando mensagem...", {
              conversationId,
              externalMsgId,
              fromMe,
              senderName,
              contentPreview: content.slice(0, 80),
            });

            const { data: insertedMsg, error: insertErr } = await supabaseAdmin
              .from("messages")
              .insert({
                conversation_id: conversationId,
                content,
                from_me: fromMe,
                sender_name: senderName,
                sender_phone: contactDigits || null,
                external_id: externalMsgId ?? null,
              })
              .select("id")
              .maybeSingle();

            if (insertErr) {
              if (insertErr.code === "23505") {
                console.log("♻️ Mensagem duplicada (external_id já existe) — ignorando");
                skipped++;
                continue;
              }
              console.log("❌ ERRO AO SALVAR MENSAGEM:");
              console.log(insertErr);
              skipped++;
              continue;
            }
            console.log("✅ MENSAGEM SALVA:", insertedMsg);

            console.log("🔄 Atualizando última mensagem da conversa");
            const { error: updateErr } = await supabaseAdmin
              .from("conversations")
              .update({
                last_message: content,
                last_message_at: new Date().toISOString(),
              })
              .eq("id", conversationId);
            if (updateErr) {
              console.log("⚠️ Erro ao atualizar conversa:", updateErr);
            }

            processed++;
          } catch (e) {
            console.error("💥 Erro processando mensagem:", e);
            skipped++;
          }
        }

        console.log(`\n✅ WEBHOOK PROCESSADO COM SUCESSO — processed=${processed} skipped=${skipped}`);
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
  if (!digits) {
    console.log("⚠️ findWorkspaceByNumber: digits vazio");
    return null;
  }
  const { data: exact, error: exactErr } = await supabaseAdmin
    .from("workspaces")
    .select("id, name, whatsapp_number")
    .eq("whatsapp_number", digits)
    .maybeSingle();
  if (exactErr) console.log("⚠️ Erro busca exata workspace:", exactErr);
  if (exact) {
    console.log("🎯 Match exato workspace:", exact.id);
    return exact;
  }

  const { data: all, error: allErr } = await supabaseAdmin
    .from("workspaces")
    .select("id, name, whatsapp_number")
    .not("whatsapp_number", "is", null);
  if (allErr) console.log("⚠️ Erro listando workspaces:", allErr);
  if (!all) return null;
  const match =
    all.find((w) => {
      const wd = digitsOnly(w.whatsapp_number);
      if (!wd) return false;
      return wd === digits || wd.endsWith(digits) || digits.endsWith(wd);
    }) ?? null;
  if (match) {
    console.log("🎯 Match por sufixo workspace:", match.id, "(", match.whatsapp_number, ")");
  } else {
    console.log("🚫 Nenhum workspace bateu. Total candidatos:", all.length);
  }
  return match;
}

async function upsertConversation(params: {
  workspaceId: string;
  externalId: string;
  isGroup: boolean;
  name: string;
}) {
  const { workspaceId, externalId, isGroup, name } = params;
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (selErr) console.log("⚠️ Erro buscando conversa:", selErr);
  if (existing) {
    console.log("📁 Conversa existente encontrada:", existing.id);
    return existing.id;
  }

  console.log("➕ Criando nova conversa", { workspaceId, externalId, isGroup, name });
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
  if (error) {
    console.log("❌ Erro criando conversa:", error);
    throw error;
  }
  console.log("🆕 Conversa criada:", created.id);
  return created.id;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
