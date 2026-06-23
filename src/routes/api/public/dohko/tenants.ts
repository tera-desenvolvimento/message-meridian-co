import { createFileRoute } from "@tanstack/react-router";
import { requireDohkoAdmin } from "@/lib/dohko-auth.server";

interface DohkoTenantPatch {
  id?: string;
  name?: string;
  active?: boolean;
  membershipId?: string;
  membershipActive?: boolean;
}

interface ProfileRow {
  id: string;
  name: string;
  email: string | null;
}

interface MembershipRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: string;
  active: boolean;
  created_at: string;
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

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

        const supabaseAdmin = await getAdminClient();

        const { data: workspaces, error } = await supabaseAdmin
          .from("workspaces")
          .select("id, name, created_at, active, created_by")
          .order("created_at", { ascending: false });
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const ids = (workspaces ?? []).map((w) => w.id);
        const [membersRes, integrationsRes] = await Promise.all([
          supabaseAdmin
            .from("memberships")
            .select("id, workspace_id, user_id, role, active, created_at")
            .in("workspace_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
          supabaseAdmin
            .from("workspace_integrations")
            .select("workspace_id, provider, phone_number")
            .in("workspace_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
        ]);

        if (membersRes.error) return Response.json({ error: membersRes.error.message }, { status: 500 });
        if (integrationsRes.error) return Response.json({ error: integrationsRes.error.message }, { status: 500 });

        const memberships = (membersRes.data ?? []) as MembershipRow[];
        const userIds = Array.from(new Set(memberships.map((m) => m.user_id)));
        const profilesRes = await supabaseAdmin
          .from("profiles")
          .select("id, name, email")
          .in("id", userIds.length ? userIds : ["00000000-0000-0000-0000-000000000000"]);
        if (profilesRes.error) return Response.json({ error: profilesRes.error.message }, { status: 500 });

        const memberCount = new Map<string, number>();
        const usersByWorkspace = new Map<string, Array<MembershipRow & { profile: ProfileRow | null }>>();
        const profileById = new Map((profilesRes.data ?? []).map((p) => [p.id, p as ProfileRow]));
        for (const m of memberships) {
          memberCount.set(m.workspace_id, (memberCount.get(m.workspace_id) ?? 0) + 1);
          const list = usersByWorkspace.get(m.workspace_id) ?? [];
          list.push({ ...m, profile: profileById.get(m.user_id) ?? null });
          usersByWorkspace.set(m.workspace_id, list);
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
            users: (usersByWorkspace.get(w.id) ?? []).map((m) => ({
              membershipId: m.id,
              id: m.user_id,
              name: m.profile?.name ?? "Usuário sem perfil",
              email: m.profile?.email ?? "sem e-mail",
              role: m.role,
              active: m.active,
              joinedAt: m.created_at,
            })),
          })),
        });
      },

      POST: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;
        const supabaseAdmin = await getAdminClient();
        const body = (await request.json().catch(() => ({}))) as { name?: string };
        const name = (body.name ?? "").trim();
        if (!name || name.length > 80) {
          return Response.json({ error: "Nome inválido (1–80 caracteres)" }, { status: 400 });
        }
        const { data, error } = await supabaseAdmin
          .from("workspaces")
          .insert({ name, active: true, created_by: null })
          .select("id, name, active, created_at")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ tenant: data });
      },

      PATCH: async ({ request }) => {
        const auth = await requireDohkoAdmin(request);
        if (auth instanceof Response) return auth;
        const supabaseAdmin = await getAdminClient();
        const body = (await request.json().catch(() => ({}))) as DohkoTenantPatch;

        if (body.membershipId && typeof body.membershipActive === "boolean") {
          const { data, error } = await supabaseAdmin
            .from("memberships")
            .update({ active: body.membershipActive })
            .eq("id", body.membershipId)
            .select("id, active")
            .single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ membership: data });
        }

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
        const supabaseAdmin = await getAdminClient();
        const id = new URL(request.url).searchParams.get("id");
        if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 });
        const { error } = await supabaseAdmin.from("workspaces").delete().eq("id", id);
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true });
      },
    },
  },
});
