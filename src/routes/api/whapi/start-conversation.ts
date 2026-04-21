import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

const BodySchema = z.object({
  phone: z.string().min(6).max(32),
  name: z.string().min(1).max(120),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function digitsOnly(input: string): string {
  return (input.match(/\d+/g) ?? []).join("");
}

export const Route = createFileRoute("/api/whapi/start-conversation")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
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

          const rawBody = await request.json();
          const parsed = BodySchema.safeParse(rawBody);
          if (!parsed.success) {
            return jsonResponse(
              { error: "Dados inválidos", details: parsed.error.flatten() },
              400,
            );
          }
          const { phone, name } = parsed.data;

          const digits = digitsOnly(phone);
          if (digits.length < 8) {
            return jsonResponse({ error: "Número de telefone inválido" }, 400);
          }

          // Get the user's active workspace via membership (RLS-safe).
          const { data: membership, error: memberErr } = await userClient
            .from("memberships")
            .select("workspace_id, active")
            .eq("user_id", userId)
            .eq("active", true)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (memberErr) {
            return jsonResponse({ error: "Erro ao identificar workspace" }, 500);
          }
          if (!membership) {
            return jsonResponse({ error: "Você não pertence a nenhum workspace ativo" }, 403);
          }
          const workspaceId = membership.workspace_id;

          // Verify Whapi integration exists & enabled (admin client – token is admin-only).
          const { data: integration, error: integErr } = await supabaseAdmin
            .from("workspace_integrations")
            .select("enabled, token")
            .eq("workspace_id", workspaceId)
            .eq("provider", "whapi")
            .maybeSingle();

          if (integErr) {
            return jsonResponse({ error: "Erro ao verificar integração" }, 500);
          }
          if (!integration || !integration.enabled || !integration.token) {
            return jsonResponse(
              { error: "Integração WhatsApp não configurada para este workspace" },
              400,
            );
          }

          // WhatsApp private chat id format used by Whapi.
          const externalId = `${digits}@s.whatsapp.net`;

          // Try to find existing conversation
          const { data: existing, error: existErr } = await supabaseAdmin
            .from("conversations")
            .select("id, name")
            .eq("workspace_id", workspaceId)
            .eq("external_id", externalId)
            .maybeSingle();

          if (existErr) {
            return jsonResponse({ error: "Erro ao buscar conversa existente" }, 500);
          }

          if (existing) {
            return jsonResponse({
              ok: true,
              created: false,
              conversation: { id: existing.id, name: existing.name },
            });
          }

          const { data: created, error: insertErr } = await supabaseAdmin
            .from("conversations")
            .insert({
              workspace_id: workspaceId,
              external_id: externalId,
              name,
              type: "PRIVATE",
              status: "OPEN",
              last_message: "",
              last_message_at: new Date().toISOString(),
            })
            .select("id, name")
            .single();

          if (insertErr) {
            console.error("[start-conversation] insert error", insertErr.message);
            return jsonResponse({ error: "Não foi possível criar a conversa" }, 500);
          }

          return jsonResponse({
            ok: true,
            created: true,
            conversation: { id: created.id, name: created.name },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("[start-conversation] erro inesperado:", msg);
          return jsonResponse({ error: msg }, 500);
        }
      },
    },
  },
});
