import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface InvitePayload {
  id: string;
  workspace_id: string;
  email: string | null;
  role: "ADMIN" | "AGENT";
  expires_at: string;
  accepted_at: string | null;
}

async function loadInvite(token: string): Promise<
  | { ok: true; invite: InvitePayload; workspaceName: string }
  | { ok: false; status: number; error: string }
> {
  if (!token || typeof token !== "string") {
    return { ok: false, status: 400, error: "Token inválido." };
  }
  const { data, error } = await supabaseAdmin
    .from("invitations")
    .select("id, workspace_id, email, role, expires_at, accepted_at")
    .eq("token", token)
    .maybeSingle();
  if (error) return { ok: false, status: 500, error: error.message };
  if (!data) return { ok: false, status: 404, error: "Convite não encontrado." };
  if (data.accepted_at) return { ok: false, status: 410, error: "Este convite já foi utilizado." };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, status: 410, error: "Este convite expirou." };
  }
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("name")
    .eq("id", data.workspace_id)
    .maybeSingle();
  return { ok: true, invite: data as InvitePayload, workspaceName: ws?.name ?? "Workspace" };
}

export const Route = createFileRoute("/api/public/accept-invite")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        const result = await loadInvite(token);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }
        return Response.json({
          email: result.invite.email,
          role: result.invite.role,
          workspaceName: result.workspaceName,
        });
      },
      POST: async ({ request }) => {
        let body: { token?: string; name?: string; email?: string; password?: string } = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido." }, { status: 400 });
        }
        const token = (body.token ?? "").trim();
        const result = await loadInvite(token);
        if (!result.ok) {
          return Response.json({ error: result.error }, { status: result.status });
        }
        const invite = result.invite;

        const email = (body.email ?? invite.email ?? "").trim().toLowerCase();
        const name = (body.name ?? "").trim();
        const password = body.password ?? "";

        if (!email) {
          return Response.json({ error: "E-mail é obrigatório." }, { status: 400 });
        }
        if (!password || password.length < 6) {
          return Response.json(
            { error: "Senha deve ter ao menos 6 caracteres." },
            { status: 400 },
          );
        }

        // Find or create the auth user.
        let userId: string | null = null;
        const { data: existingList } = await supabaseAdmin.auth.admin.listUsers();
        const existing = existingList?.users.find(
          (u) => u.email?.toLowerCase() === email,
        );

        if (existing) {
          userId = existing.id;
          // Verify the password matches by attempting a sign-in via publishable key.
          const SUPABASE_URL = process.env.SUPABASE_URL!;
          const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
          const verify = await fetch(
            `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({ email, password }),
            },
          );
          if (!verify.ok) {
            return Response.json(
              {
                error:
                  "Já existe uma conta com este e-mail. Informe a senha correta para aceitar o convite.",
              },
              { status: 401 },
            );
          }
        } else {
          const { data: created, error: createErr } =
            await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { name: name || email.split("@")[0] },
            });
          if (createErr || !created?.user) {
            return Response.json(
              { error: createErr?.message ?? "Falha ao criar usuário." },
              { status: 500 },
            );
          }
          userId = created.user.id;
        }

        if (!userId) {
          return Response.json({ error: "Falha ao identificar usuário." }, { status: 500 });
        }

        // Ensure profile name is set.
        if (name) {
          await supabaseAdmin
            .from("profiles")
            .update({ name })
            .eq("id", userId);
        }

        // Create membership (or reactivate / update role if it already exists).
        const { data: existingMembership } = await supabaseAdmin
          .from("memberships")
          .select("id")
          .eq("workspace_id", invite.workspace_id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existingMembership) {
          const { error: updErr } = await supabaseAdmin
            .from("memberships")
            .update({ role: invite.role, active: true })
            .eq("id", existingMembership.id);
          if (updErr) {
            return Response.json({ error: updErr.message }, { status: 500 });
          }
        } else {
          const { error: insErr } = await supabaseAdmin.from("memberships").insert({
            workspace_id: invite.workspace_id,
            user_id: userId,
            role: invite.role,
            active: true,
          });
          if (insErr) {
            return Response.json({ error: insErr.message }, { status: 500 });
          }
        }

        // Mark invite as accepted.
        await supabaseAdmin
          .from("invitations")
          .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
          .eq("id", invite.id);

        return Response.json({ ok: true, email });
      },
    },
  },
});
