import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireDohkoAdmin } from "@/lib/dohko-auth.server";

/**
 * /api/public/dohko/tenants
 *
 * GET    -> lista workspaces com contagens.
 * POST   -> cria workspace { name }.
 * PATCH  -> atualiza { id, name?, active? }.
 * DELETE -> remove ?id=...
 *
 * Todas as operações exigem cookie `dohko_session` válido.
 */
export const Route = createFileRoute("/api/public/dohko/tenants")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;

        const { data: workspaces, error } = await supabaseAdmin
          .from("workspaces")
          .select("id, name, created_at, active, created_by")
          .order("created_at", { ascending: false });
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const ids = (workspaces ?? []).map((w) => w.id);
        const [membersRes, integrationsRes] = await Promise.all([
          supabaseAdmin
            .from("memberships")
            .select("workspace_id, user_id")
            .in("workspace_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
          supabaseAdmin
            .from("workspace_integrations")
            .select("workspace_id, provider, phone_number")
            .in("workspace_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        ]);

        const memberCount = new Map<string, number>();
        for (const m of membersRes.data ?? []) {
          memberCount.set(m.workspace_id, (memberCount.get(m.workspace_id) ?? 0) + 1);
        }
        const integrationByWs = new Map<string, { provider: string; phone_number: string | null }>();
        for (const i of integrationsRes.data ?? []) {
          integrationByWs.set(i.workspace_id, { provider: i.provider, phone_number: i.phone_number });
        }

        return Response.json({
          tenants: (workspaces ?? []).map((w) => ({
            id: w.id,
            name: w.name,
            createdAt: w.created_at,
            active: w.active,
            createdBy: w.created_by,
            members: memberCount.get(w.id) ?? 0,
            integration: integrationByWs.get(w.id) ?? null,
          })),
        });
      },

      POST: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;
        const body = (await request.json().catch(() => ({}))) as { name?: string };
        const name = (body.name ?? "").trim();
        if (!name || name.length > 80) {
          return Response.json({ error: "Nome inválido (1–80 caracteres)" }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
          .from("workspaces")
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert({ name, active: true, created_by: null } as any)
          .select("id, name, active, created_at")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ tenant: data });
      },

      PATCH: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;
        const body = (await request.json().catch(() => ({}))) as {
          id?: string;
          name?: string;
          active?: boolean;
        };
        if (!body.id) return Response.json({ error: "id obrigatório" }, { status: 400 });
        const patch: { name?: string; active?: boolean } = {};
        if (typeof body.name === "string") {
          const n = body.name.trim();
          if (!n || n.length > 80) return Response.json({ error: "Nome inválido" }, { status: 400 });
          patch.name = n;
        }
        if (typeof body.active === "boolean") patch.active = body.active;
        if (Object.keys(patch).length === 0) {
          return Response.json({ error: "Nada para atualizar" }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
          .from("workspaces")
          .update(patch)
          .eq("id", body.id)
          .select("id, name, active")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ tenant: data });
      },

      DELETE: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });
        const { error } = await supabaseAdmin.from("workspaces").delete().eq("id", id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
