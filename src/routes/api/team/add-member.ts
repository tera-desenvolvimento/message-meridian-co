import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

/**
 * POST /api/team/add-member
 * Body: { email: string, role: "ADMIN" | "AGENT" }
 *
 * Lookup a user by e-mail (must already have an account on the platform)
 * and add them as an active member of the caller's workspace.
 *
 * Auth: caller must be ADMIN of the workspace.
 */

interface Body {
  email?: string;
  role?: "ADMIN" | "AGENT";
}

async function getCallerContext(token: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims?.sub) return null;
  const userId = claims.claims.sub as string;

  // Find the caller's workspace + role.
  const { data: m } = await supabaseAdmin
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!m) return null;
  return { userId, workspaceId: m.workspace_id, role: m.role as "ADMIN" | "AGENT" };
}

export const Route = createFileRoute("/api/team/add-member")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        const token = authHeader.slice(7);

        const ctx = await getCallerContext(token);
        if (!ctx) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (ctx.role !== "ADMIN" && ctx.role !== "SUPERADMIN") {
          return Response.json(
            { error: "Apenas administradores podem adicionar membros." },
            { status: 403 },
          );
        }

        let body: Body = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido." }, { status: 400 });
        }

        const email = (body.email ?? "").trim().toLowerCase();
        const allowedRoles = ["SUPERADMIN", "ADMIN", "SUPERVISOR", "AGENT"] as const;
        const requested = (body.role ?? "AGENT") as (typeof allowedRoles)[number];
        let role: (typeof allowedRoles)[number] = allowedRoles.includes(requested)
          ? requested
          : "AGENT";
        // Apenas SUPERADMIN pode promover outro SUPERADMIN.
        if (role === "SUPERADMIN" && ctx.role !== "SUPERADMIN") {
          role = "ADMIN";
        }

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ error: "Informe um e-mail válido." }, { status: 400 });
        }

        // 1) Look up the profile (case-insensitive on e-mail).
        const { data: profile, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, name, email")
          .ilike("email", email)
          .maybeSingle();

        if (pErr) {
          return Response.json({ error: pErr.message }, { status: 500 });
        }

        if (!profile) {
          return Response.json(
            {
              error:
                "Nenhum usuário cadastrado com este e-mail. Peça para a pessoa criar uma conta na plataforma primeiro.",
              code: "USER_NOT_FOUND",
            },
            { status: 404 },
          );
        }

        // 2) If membership already exists, reactivate / update role.
        const { data: existing } = await supabaseAdmin
          .from("memberships")
          .select("id, active, role")
          .eq("workspace_id", ctx.workspaceId)
          .eq("user_id", profile.id)
          .maybeSingle();

        if (existing) {
          if (existing.active && existing.role === role) {
            return Response.json(
              {
                error: "Este usuário já é membro da equipe.",
                code: "ALREADY_MEMBER",
              },
              { status: 409 },
            );
          }
          const { error: updErr } = await supabaseAdmin
            .from("memberships")
            .update({ role, active: true })
            .eq("id", existing.id);
          if (updErr) {
            return Response.json({ error: updErr.message }, { status: 500 });
          }
          return Response.json({
            ok: true,
            reactivated: true,
            user: { id: profile.id, name: profile.name, email: profile.email },
          });
        }

        // 3) Create new membership.
        const { error: insErr } = await supabaseAdmin.from("memberships").insert({
          workspace_id: ctx.workspaceId,
          user_id: profile.id,
          role,
          active: true,
        });
        if (insErr) {
          return Response.json({ error: insErr.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          user: { id: profile.id, name: profile.name, email: profile.email },
        });
      },
    },
  },
});
