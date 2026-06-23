import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

/**
 * POST /api/team/join-by-code
 * Body: { code: string }  (the workspace id, shared by an admin)
 *
 * Adds the calling authenticated user as an ACTIVE AGENT member of the
 * workspace identified by `code`. If they're already a member, just
 * reactivates the membership and returns the workspace.
 */

interface Body {
  code?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/api/team/join-by-code")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return Response.json({ error: "Não autenticado." }, { status: 401 });
        }
        const token = authHeader.slice(7);

        const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) {
          return Response.json({ error: "Sessão inválida." }, { status: 401 });
        }
        const userId = claims.claims.sub as string;

        let body: Body = {};
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "JSON inválido." }, { status: 400 });
        }

        const code = (body.code ?? "").trim().toLowerCase();
        if (!code || !UUID_RE.test(code)) {
          return Response.json(
            { error: "Código de equipe inválido. Peça o código correto ao administrador." },
            { status: 400 },
          );
        }

        // Validate workspace exists
        const { data: ws, error: wsErr } = await supabaseAdmin
          .from("workspaces")
          .select("id, name, created_at, trial_ends_at, subscription_active")
          .eq("id", code)
          .maybeSingle();
        if (wsErr) {
          return Response.json({ error: wsErr.message }, { status: 500 });
        }
        if (!ws) {
          return Response.json(
            { error: "Nenhuma equipe encontrada com esse código." },
            { status: 404 },
          );
        }

        // Check existing membership
        const { data: existing } = await supabaseAdmin
          .from("memberships")
          .select("id, active, role")
          .eq("workspace_id", ws.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (existing) {
          if (!existing.active) {
            const { error: updErr } = await supabaseAdmin
              .from("memberships")
              .update({ active: true })
              .eq("id", existing.id);
            if (updErr) {
              return Response.json({ error: updErr.message }, { status: 500 });
            }
          }
          return Response.json({
            ok: true,
            reactivated: !existing.active,
            workspace: { id: ws.id, name: ws.name, createdAt: ws.created_at, trialEndsAt: (ws as any).trial_ends_at, subscriptionActive: (ws as any).subscription_active },
          });
        }

        const { error: insErr } = await supabaseAdmin.from("memberships").insert({
          workspace_id: ws.id,
          user_id: userId,
          role: "AGENT",
          active: true,
        });
        if (insErr) {
          return Response.json({ error: insErr.message }, { status: 500 });
        }

        return Response.json({
          ok: true,
          workspace: { id: ws.id, name: ws.name, createdAt: ws.created_at, trialEndsAt: (ws as any).trial_ends_at, subscriptionActive: (ws as any).subscription_active },
        });
      },
    },
  },
});
