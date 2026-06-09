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
            const isGroup = String(chatId).includes("@g.us");

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

            // Identificar telefone do remetente real:
            // - Grupo: msg.author (quem enviou no grupo) ou msg.from quando from_me
            // - Privado: msg.from (ou chat_id quando from_me)
            let senderRaw: unknown;
            if (fromMe) {
              senderRaw = accountCandidate?.raw || msg?.from || chatId;
            } else if (isGroup) {
              senderRaw = msg?.author || msg?.from_phone || msg?.from;
            } else {
              senderRaw = msg?.from || chatId;
            }
            const contactDigits = digitsOnly(senderRaw);

            console.log("🔍 Buscando workspace pelo número...", {
              accountNumberRaw,
              accountDigits,
              contactDigits,
              isGroup,
              senderRaw,
            });

            let workspace = await findWorkspaceByNumber(accountDigits);
            if (!workspace && providedSecret) {
              workspace = await findWorkspaceByWebhookSecret(providedSecret);
            }
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

            // Nome do REMETENTE (pessoa que enviou a mensagem)
            const senderName: string =
              msg?.from_name ||
              msg?.push_name ||
              msg?.author_name ||
              (contactDigits ? `+${contactDigits}` : "Contato");

            // Telefone/digits do CONTATO da conversa (destinatário em privado, ou o próprio chat).
            // Para conversas privadas isso é o `chat_id` (sem o sufixo @s.whatsapp.net),
            // independentemente de quem enviou a mensagem.
            const chatContactDigits = String(chatId).split("@")[0]?.replace(/\D+/g, "") ?? "";

            // Nome da CONVERSA:
            // - Grupo: usar chat_name (nome do grupo) — NUNCA usar nome do remetente
            // - Privado: SOMENTE usar dados do contato (chat). NUNCA usar from_name/push_name
            //   quando from_me=true, pois esse é o nome da NOSSA própria linha (ex.: "Base03"),
            //   não do contato. Se a mensagem é recebida (from_me=false), aí sim from_name é
            //   o nome do contato. Caso contrário, cair no número/placeholder e deixar o
            //   maybeFetchProfilePic buscar o nome real via API.
            const conversationName: string | null = isGroup
              ? msg?.chat_name || payload?.chat?.name || null
              : (!fromMe && (msg?.from_name || msg?.push_name)) ||
                msg?.chat_name ||
                payload?.chat?.name ||
                (chatContactDigits ? `+${chatContactDigits}` : null);

            // Profile picture (avatar) — Whapi sometimes includes these inline
            const senderAvatar: string | null =
              msg?.from_image ||
              msg?.from_picture ||
              msg?.profile_picture ||
              msg?.profile_pic ||
              msg?.image ||
              null;
            const conversationAvatar: string | null = isGroup
              ? msg?.chat_image || msg?.chat_picture || payload?.chat?.image || null
              : fromMe
                ? null // não usar avatar do remetente (nós) para a conversa do contato
                : senderAvatar;

            // Extract media (image, video, audio, document, sticker) URL/metadata from Whapi payload.
            // Whapi typically exposes the media object under msg[<type>] with `link` (CDN URL),
            // `mime_type` and a `caption` for visual media. We persist the link so the UI can render it.
            const mediaInfo = extractMedia(msg);

            const content: string =
              msg?.text?.body ||
              msg?.caption ||
              msg?.image?.caption ||
              msg?.video?.caption ||
              msg?.document?.caption ||
              (mediaInfo ? "" : `[${msg?.type || "mensagem"}]`);
            const externalMsgId: string | undefined = msg?.id;

            console.log("🔎 Buscando conversa...", {
              workspaceId: workspace.id,
              externalId: chatId,
              isGroup,
              conversationName,
              senderName,
            });
            const conversationId = await upsertConversation({
              workspaceId: workspace.id,
              externalId: chatId,
              isGroup,
              name: conversationName,
              avatarUrl: conversationAvatar,
            });
            console.log("💬 CONVERSA:", { id: conversationId });

            // Best-effort: fetch profile picture from Whapi if we don't have one yet.
            // Runs for groups and private chats (regardless of fromMe).
            if (integ?.enabled !== false) {
              void maybeFetchProfilePic({
                conversationId,
                chatId,
                workspaceId: workspace.id,
                isGroup,
              });
            }

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
                sender_avatar_url: senderAvatar,
                external_id: externalMsgId ?? null,
                media_url: mediaInfo?.url ?? null,
                media_mime_type: mediaInfo?.mimeType ?? null,
                media_type: mediaInfo?.type ?? null,
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

        // Process Bot Logic
        if (processed > 0) {
          try {
            const { processBotMessage } = await import("@/lib/bot-runner");
            // Usamos a última conversa processada
            console.log("🤖 Iniciando processamento de bot...");
            // await processBotMessage(conversationId, content);
          } catch (botErr) {
            console.error("❌ Erro no processamento do bot:", botErr);
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

/**
 * Extracts media (image, video, audio, document, sticker) info from a Whapi
 * message payload. Whapi exposes media under msg[<type>] with `link` (signed
 * CDN URL) and `mime_type`. Returns null when there's no media URL.
 */
function extractMedia(msg: any): { url: string; mimeType: string | null; type: string } | null {
  const candidates: Array<{ key: string; type: string }> = [
    { key: "image", type: "image" },
    { key: "video", type: "video" },
    { key: "audio", type: "audio" },
    { key: "voice", type: "audio" },
    { key: "ptt", type: "audio" },
    { key: "document", type: "document" },
    { key: "sticker", type: "image" },
  ];
  for (const { key, type } of candidates) {
    const node = msg?.[key];
    if (!node) continue;
    const url: string | undefined =
      node.link || node.url || node.preview_url || node.thumbnail_url;
    if (typeof url === "string" && url.startsWith("http")) {
      return { url, mimeType: node.mime_type ?? node.mimetype ?? null, type };
    }
  }
  return null;
}

function firstPhoneCandidate(values: unknown[]): { raw: unknown; digits: string } | null {
  for (const raw of values) {
    const digits = digitsOnly(raw);
    if (digits.length >= 8) return { raw, digits };
  }
  return null;
}

async function findSingleEnabledWhapiWorkspace() {
  const { data, error } = await supabaseAdmin
    .from("workspace_integrations")
    .select("workspace_id")
    .eq("provider", "whapi")
    .eq("enabled", true);
  if (error) console.log("⚠️ Erro buscando fallback de integração:", error);
  const workspaceIds = [...new Set((data ?? []).map((row) => row.workspace_id).filter(Boolean))];
  if (workspaceIds.length === 1) {
    const { data: workspace, error: wsErr } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, whatsapp_number")
      .eq("id", workspaceIds[0])
      .maybeSingle();
    if (wsErr) console.log("⚠️ Erro carregando workspace fallback:", wsErr);
    if (workspace) {
      console.log("🎯 Fallback: único workspace Whapi ativo encontrado:", workspace.id);
      return workspace;
    }
  }
  console.log("🚫 Fallback Whapi não aplicável. Workspaces ativos:", workspaceIds.length);
  return null;
}

async function findWorkspaceByWebhookSecret(secret: string) {
  const { data: integ, error } = await supabaseAdmin
    .from("workspace_integrations")
    .select("workspace_id")
    .eq("provider", "whapi")
    .eq("enabled", true)
    .eq("webhook_secret", secret)
    .maybeSingle();
  if (error) console.log("⚠️ Erro buscando workspace pelo secret:", error);
  if (!integ?.workspace_id) return null;
  const { data: workspace, error: wsErr } = await supabaseAdmin
    .from("workspaces")
    .select("id, name, whatsapp_number")
    .eq("id", integ.workspace_id)
    .maybeSingle();
  if (wsErr) console.log("⚠️ Erro carregando workspace por secret:", wsErr);
  if (workspace) console.log("🎯 Match workspace por secret do webhook:", workspace.id);
  return workspace ?? null;
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
  name: string | null;
  avatarUrl?: string | null;
}) {
  const { workspaceId, externalId, isGroup, name, avatarUrl } = params;
  const { data: existing, error: selErr } = await supabaseAdmin
    .from("conversations")
    .select("id, name, avatar_url")
    .eq("workspace_id", workspaceId)
    .eq("external_id", externalId)
    .maybeSingle();
  if (selErr) console.log("⚠️ Erro buscando conversa:", selErr);
  if (existing) {
    console.log("📁 Conversa existente encontrada:", existing.id, "name:", existing.name);
    const updates: { name?: string; avatar_url?: string; avatar_updated_at?: string } = {};
    if (name) {
      const canReplace = isGroup
        ? shouldReplaceGroupName(existing.name)
        : shouldReplaceContactName(existing.name);
      if (canReplace) updates.name = name;
    }
    if (avatarUrl && !existing.avatar_url) {
      updates.avatar_url = avatarUrl;
      updates.avatar_updated_at = new Date().toISOString();
    }
    if (Object.keys(updates).length > 0) {
      const { error: updErr } = await supabaseAdmin
        .from("conversations")
        .update(updates)
        .eq("id", existing.id);
      if (updErr) console.log("⚠️ Erro atualizando conversa:", updErr);
      else console.log("✏️ Conversa atualizada:", updates);
    }
    return existing.id;
  }

  const finalName = name || (isGroup ? "Grupo" : "Contato");
  console.log("➕ Criando nova conversa", { workspaceId, externalId, isGroup, name: finalName });
  const { data: created, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      workspace_id: workspaceId,
      external_id: externalId,
      type: isGroup ? "GROUP" : "PRIVATE",
      name: finalName,
      last_message: "",
      avatar_url: avatarUrl ?? null,
      avatar_updated_at: avatarUrl ? new Date().toISOString() : null,
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

/**
 * Best-effort fetch of a contact's or group's profile picture from Whapi.
 * Skips if the conversation already has an avatar fresher than 7 days,
 * or if the integration is unavailable. Failures are swallowed.
 */
async function maybeFetchProfilePic(params: {
  conversationId: string;
  chatId: string;
  workspaceId: string;
  isGroup: boolean;
}) {
  const { conversationId, chatId, workspaceId, isGroup } = params;
  try {
    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("avatar_url, avatar_updated_at")
      .eq("id", conversationId)
      .maybeSingle();
    if (conv?.avatar_url && conv.avatar_updated_at) {
      const ageMs = Date.now() - new Date(conv.avatar_updated_at).getTime();
      if (ageMs < 7 * 24 * 60 * 60 * 1000) return; // fresh enough
    }

    const { data: integ } = await supabaseAdmin
      .from("workspace_integrations")
      .select("api_url, token, enabled")
      .eq("workspace_id", workspaceId)
      .eq("provider", "whapi")
      .maybeSingle();
    if (!integ?.token || integ.enabled === false) return;

    const pic = await fetchWhapiAvatar({
      apiUrl: integ.api_url,
      token: integ.token,
      chatId,
      isGroup,
    });
    if (!pic) return;

    await supabaseAdmin
      .from("conversations")
      .update({ avatar_url: pic, avatar_updated_at: new Date().toISOString() })
      .eq("id", conversationId);
    console.log("🖼️ Avatar atualizado para conversa:", conversationId);
  } catch (e) {
    console.log("⚠️ maybeFetchProfilePic erro:", e instanceof Error ? e.message : e);
  }
}

export interface WhapiContactInfo {
  avatarUrl: string | null;
  name: string | null;
}

/**
 * Try multiple Whapi endpoints to fetch a contact/group profile picture URL
 * AND the canonical display name (group subject or contact push name).
 *
 * Notes about Whapi quirks:
 *  - `/contacts/{id}/profile` requires a digits-only ContactID (no `@s.whatsapp.net`).
 *  - `/groups/{id}/icon` returns a binary JPEG (not JSON). We avoid it here.
 *  - `/groups/{id}` and `/chats/{id}` return JSON metadata that includes both
 *    `chat_pic` / `chat_pic_full` and `name` / `subject`.
 */
export async function fetchWhapiContactInfo(params: {
  apiUrl: string;
  token: string;
  chatId: string;
  isGroup: boolean;
}): Promise<WhapiContactInfo> {
  const { token, chatId, isGroup } = params;
  const apiUrl = params.apiUrl.replace(/\/$/, "");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  } as const;

  // /contacts/{ContactID}/profile expects digits only (no @s.whatsapp.net).
  const contactDigits = chatId.split("@")[0]?.replace(/\D+/g, "") ?? "";

  const endpoints = isGroup
    ? [
        `${apiUrl}/groups/${encodeURIComponent(chatId)}`,
        `${apiUrl}/chats/${encodeURIComponent(chatId)}`,
      ]
    : [
        contactDigits
          ? `${apiUrl}/contacts/${encodeURIComponent(contactDigits)}/profile`
          : null,
        `${apiUrl}/chats/${encodeURIComponent(chatId)}`,
      ].filter((u): u is string => !!u);

  let foundPic: string | null = null;
  let foundName: string | null = null;

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.log(`ℹ️ whapi info fetch ${res.status}: ${url}`);
        continue;
      }
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("json")) {
        console.log(`ℹ️ whapi info non-JSON (${ct}): ${url}`);
        continue;
      }
      const data = (await res.json()) as Record<string, unknown>;

      if (!foundPic) {
        const pic =
          (data?.profile_pic_full as string | undefined) ||
          (data?.profile_pic as string | undefined) ||
          (data?.chat_pic_full as string | undefined) ||
          (data?.chat_pic as string | undefined) ||
          (data?.icon_full as string | undefined) ||
          (data?.icon as string | undefined) ||
          (data?.image as string | undefined) ||
          null;
        if (pic) foundPic = pic;
      }

      if (!foundName) {
        const name =
          (data?.subject as string | undefined) || // groups
          (data?.name as string | undefined) || // contacts/chats
          (data?.pushname as string | undefined) ||
          (data?.push_name as string | undefined) ||
          (data?.formatted_name as string | undefined) ||
          (data?.display_name as string | undefined) ||
          null;
        if (name && typeof name === "string" && name.trim()) {
          foundName = name.trim();
        }
      }

      if (foundPic && foundName) break;
    } catch (e) {
      console.log(`⚠️ whapi info fetch error: ${url}`, e instanceof Error ? e.message : e);
    }
  }

  return { avatarUrl: foundPic, name: foundName };
}

/**
 * Backwards-compatible helper that only returns the avatar URL.
 * @deprecated Use fetchWhapiContactInfo instead.
 */
export async function fetchWhapiAvatar(params: {
  apiUrl: string;
  token: string;
  chatId: string;
  isGroup: boolean;
}): Promise<string | null> {
  const info = await fetchWhapiContactInfo(params);
  return info.avatarUrl;
}

function shouldReplaceGroupName(current: string | null | undefined): boolean {
  if (!current) return true;
  const trimmed = current.trim();
  if (!trimmed) return true;
  if (trimmed.toLowerCase() === "grupo") return true;
  if (trimmed.toLowerCase() === "contato") return true;
  // Apenas dígitos / placeholder de telefone
  if (/^\+?\d[\d\s-]*$/.test(trimmed)) return true;
  return false;
}

/**
 * For private contacts: only replace the stored name if it's a placeholder
 * (empty, "Contato", or just digits like "+5511..."). We never overwrite a
 * human-edited name with whatever WhatsApp's push name says today.
 */
export function shouldReplaceContactName(current: string | null | undefined): boolean {
  if (!current) return true;
  const trimmed = current.trim();
  if (!trimmed) return true;
  if (trimmed.toLowerCase() === "contato") return true;
  if (/^\+?\d[\d\s-]*$/.test(trimmed)) return true;
  return false;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
