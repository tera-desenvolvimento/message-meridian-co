import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function authenticate(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: jsonResponse({ error: "Não autenticado" }, 401) };
  const token = authHeader.slice(7);
  const SUPABASE_URL = process.env.SUPABASE_URL!;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const userClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data: claims, error } = await userClient.auth.getClaims(token);
  if (error || !claims?.claims?.sub) return { error: jsonResponse({ error: "Token inválido" }, 401) };
  const userId = claims.claims.sub as string;

  const { data: membership } = await userClient
    .from("memberships")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership) return { error: jsonResponse({ error: "Workspace não encontrado" }, 404) };
  if (membership.role !== "ADMIN") return { error: jsonResponse({ error: "Apenas administradores" }, 403) };
  return { userId, workspaceId: membership.workspace_id as string };
}

async function getIntegration(workspaceId: string) {
  const { data } = await supabaseAdmin
    .from("workspace_integrations")
    .select("api_url, token")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whapi")
    .maybeSingle();
  return data;
}

export const Route = createFileRoute("/api/whapi/channel")({
  server: {
    handlers: {
      // GET = status + QR (if not authenticated)
      GET: async ({ request }) => {
        const auth = await authenticate(request);
        if ("error" in auth) return auth.error;
        const integ = await getIntegration(auth.workspaceId);
        if (!integ?.token) return jsonResponse({ error: "Token Whapi não configurado" }, 400);
        const apiUrl = integ.api_url.replace(/\/$/, "");

        try {
          const healthRes = await fetch(`${apiUrl}/health?wakeup=true&channel_type=web`, {
            headers: { Authorization: `Bearer ${integ.token}`, Accept: "application/json" },
          });
          const health = (await healthRes.json().catch(() => ({}))) as any;
          if (!healthRes.ok) {
            return jsonResponse({ error: health?.message || `Whapi ${healthRes.status}` }, 502);
          }
          const statusText: string =
            health?.status?.text || health?.status?.code || health?.status || "UNKNOWN";
          const phone: string | null = health?.user?.id || null;
          const name: string | null = health?.user?.name || null;

          // If not authenticated, fetch QR
          let qrImage: string | null = null;
          const needsQr = !["AUTH", "ACTIVE", "CONNECTED"].includes(String(statusText).toUpperCase());
          if (needsQr) {
            const qrRes = await fetch(`${apiUrl}/users/login/image?size=300`, {
              headers: { Authorization: `Bearer ${integ.token}`, Accept: "application/json" },
            });
            if (qrRes.ok) {
              const qrJson = (await qrRes.json().catch(() => ({}))) as any;
              const b64 = qrJson?.base64 || qrJson?.qr || qrJson?.image || null;
              if (b64) qrImage = b64.startsWith("data:") ? b64 : `data:image/png;base64,${b64}`;
            }
          }
          return jsonResponse({ status: statusText, phone, name, qrImage });
        } catch (e) {
          return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 502);
        }
      },

      // DELETE = logout (disconnect current number)
      DELETE: async ({ request }) => {
        const auth = await authenticate(request);
        if ("error" in auth) return auth.error;
        const integ = await getIntegration(auth.workspaceId);
        if (!integ?.token) return jsonResponse({ error: "Token Whapi não configurado" }, 400);
        const apiUrl = integ.api_url.replace(/\/$/, "");

        try {
          const res = await fetch(`${apiUrl}/users/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${integ.token}`, Accept: "application/json" },
          });
          const body = await res.text();
          if (!res.ok) {
            return jsonResponse({ error: `Whapi ${res.status}: ${body.slice(0, 200)}` }, 502);
          }
          // Clear stored phone
          await supabaseAdmin
            .from("workspace_integrations")
            .update({ phone_number: null })
            .eq("workspace_id", auth.workspaceId)
            .eq("provider", "whapi");
          await supabaseAdmin
            .from("workspaces")
            .update({ whatsapp_number: null })
            .eq("id", auth.workspaceId);
          return jsonResponse({ ok: true });
        } catch (e) {
          return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 502);
        }
      },
    },
  },
});
