import { createFileRoute } from "@tanstack/react-router";
import { requireDohkoAdmin } from "@/lib/dohko-auth.server";

/**
 * /api/public/dohko/integration
 *
 * GET  ?workspaceId=... -> retorna integração whapi do workspace (sem mascarar).
 * PUT  { workspaceId, api_url, token, webhook_secret, phone_number, enabled }
 *      -> faz upsert da integração.
 *
 * Exige cookie `dohko_session`.
 */
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

interface IntegrationPayload {
  workspaceId?: string;
  api_url?: string;
  token?: string | null;
  webhook_secret?: string | null;
  phone_number?: string | null;
  enabled?: boolean;
}

export const Route = createFileRoute("/api/public/dohko/integration")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;

        const workspaceId = new URL(request.url).searchParams.get("workspaceId");
        if (!workspaceId) {
          return Response.json({ error: "workspaceId obrigatório" }, { status: 400 });
        }

        const sb = await admin();
        const { data, error } = await sb
          .from("workspace_integrations")
          .select("id, api_url, token, webhook_secret, phone_number, enabled, provider")
          .eq("workspace_id", workspaceId)
          .eq("provider", "whapi")
          .maybeSingle();
        if (error) return Response.json({ error: error.message }, { status: 500 });

        return Response.json({
          integration: data ?? {
            api_url: "https://gate.whapi.cloud",
            token: "",
            webhook_secret: "",
            phone_number: "",
            enabled: false,
            provider: "whapi",
          },
        });
      },

      PUT: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;

        const body = (await request.json().catch(() => ({}))) as IntegrationPayload;
        if (!body.workspaceId) {
          return Response.json({ error: "workspaceId obrigatório" }, { status: 400 });
        }

        const sb = await admin();

        const payload = {
          workspace_id: body.workspaceId,
          provider: "whapi",
          api_url: (body.api_url ?? "").trim() || "https://gate.whapi.cloud",
          token: body.token?.toString().trim() || null,
          webhook_secret: body.webhook_secret?.toString().trim() || null,
          phone_number: body.phone_number?.toString().trim() || null,
          enabled: Boolean(body.enabled),
        };

        const { error } = await sb
          .from("workspace_integrations")
          .upsert(payload, { onConflict: "workspace_id,provider" });
        if (error) return Response.json({ error: error.message }, { status: 500 });

        // Sincroniza workspaces.whatsapp_number para o webhook conseguir rotear.
        const digits = (payload.phone_number ?? "").replace(/\D+/g, "");
        const { error: wsErr } = await sb
          .from("workspaces")
          .update({ whatsapp_number: digits || null })
          .eq("id", body.workspaceId);
        if (wsErr) return Response.json({ error: wsErr.message }, { status: 500 });

        return Response.json({ ok: true });
      },
    },
  },
});
