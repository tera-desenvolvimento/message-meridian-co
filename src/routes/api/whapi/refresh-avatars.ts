import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import {
  fetchWhapiContactInfo,
  shouldReplaceContactName,
} from "@/routes/api/public/whapi-webhook";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_PER_CALL = 30;

/**
 * Backfills WhatsApp profile pictures AND canonical names for the current
 * workspace. Despite the route name (kept for backwards compatibility with
 * the deployed frontend), this endpoint refreshes both fields.
 */
export const Route = createFileRoute("/api/whapi/refresh-avatars")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // ---- Auth: require a logged-in user ----
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

          // Resolve workspace via membership (server-side, trusted).
          const { data: membership } = await supabaseAdmin
            .from("memberships")
            .select("workspace_id, active")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          if (!membership?.workspace_id) {
            return jsonResponse({ error: "Sem workspace" }, 403);
          }
          const workspaceId = membership.workspace_id;

          // Get integration credentials.
          const { data: integ } = await supabaseAdmin
            .from("workspace_integrations")
            .select("api_url, token, enabled")
            .eq("workspace_id", workspaceId)
            .eq("provider", "whapi")
            .maybeSingle();
          if (!integ?.token || integ.enabled === false || !integ.api_url) {
            return jsonResponse({ ok: true, refreshed: 0, skipped: 0, reason: "no_integration" });
          }

          // Pick conversations that need a refresh: missing avatar OR
          // avatar is older than the freshness window. We also re-evaluate
          // the name on every refresh (cheap, same API call).
          const staleCutoff = new Date(Date.now() - STALE_MS).toISOString();
          const { data: convs, error: convErr } = await supabaseAdmin
            .from("conversations")
            .select("id, external_id, type, name, avatar_url, avatar_updated_at")
            .eq("workspace_id", workspaceId)
            .not("external_id", "is", null)
            .or(`avatar_url.is.null,avatar_updated_at.lt.${staleCutoff}`)
            .order("last_message_at", { ascending: false })
            .limit(MAX_PER_CALL);
          if (convErr) {
            console.log("⚠️ refresh-avatars list error:", convErr);
            return jsonResponse({ error: "Falha ao listar conversas" }, 500);
          }

          let refreshed = 0;
          let renamed = 0;
          let skipped = 0;
          const nowIso = new Date().toISOString();

          // Sequential to be polite to the Whapi API.
          for (const c of convs ?? []) {
            if (!c.external_id) {
              skipped++;
              continue;
            }
            try {
              const info = await fetchWhapiContactInfo({
                apiUrl: integ.api_url,
                token: integ.token,
                chatId: c.external_id,
                isGroup: c.type === "GROUP",
              });

              const update: {
                avatar_url?: string;
                avatar_updated_at?: string;
                name?: string;
              } = { avatar_updated_at: nowIso };

              if (info.avatarUrl) {
                update.avatar_url = info.avatarUrl;
              }

              // Only overwrite the name if the current one looks like a placeholder
              // (never clobber a human-edited name).
              if (info.name) {
                const isGroup = c.type === "GROUP";
                const placeholder = isGroup
                  ? !c.name ||
                    c.name.trim().toLowerCase() === "grupo" ||
                    /^\+?\d[\d\s-]*$/.test(c.name.trim())
                  : shouldReplaceContactName(c.name);
                if (placeholder && info.name !== c.name) {
                  update.name = info.name;
                  renamed++;
                }
              }

              await supabaseAdmin.from("conversations").update(update).eq("id", c.id);

              if (info.avatarUrl) refreshed++;
              else if (!update.name) skipped++;
            } catch (e) {
              console.log("⚠️ refresh-avatars per-conv error:", e instanceof Error ? e.message : e);
              skipped++;
            }
          }

          return jsonResponse({
            ok: true,
            refreshed,
            renamed,
            skipped,
            total: convs?.length ?? 0,
          });
        } catch (e) {
          console.error("💥 refresh-avatars fatal:", e);
          return jsonResponse({ error: "Erro interno" }, 500);
        }
      },
    },
  },
});
