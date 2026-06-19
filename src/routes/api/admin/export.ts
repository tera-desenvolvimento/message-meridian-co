import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import JSZip from "jszip";

const PUBLIC_TABLES = [
  "bot_flows",
  "bot_states",
  "conversations",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "invitations",
  "memberships",
  "messages",
  "profiles",
  "suppressed_emails",
  "workspace_integrations",
  "workspaces",
] as const;

const PAGE_SIZE = 1000;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fetchAllRows(admin: ReturnType<typeof createClient>, table: string) {
  const rows: unknown[] = [];
  let from = 0;
  // Paginate using range() to bypass the 1000-row default.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await admin.from(table).select("*").range(from, to);
    if (error) throw new Error(`[${table}] ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

async function fetchAllAuthUsers(admin: ReturnType<typeof createClient>) {
  const users: Array<Record<string, unknown>> = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw new Error(`[auth.users] ${error.message}`);
    const batch = data?.users ?? [];
    for (const u of batch) {
      // Strip any potentially sensitive material; passwords are never returned by the API,
      // but we keep an explicit allow-list to be safe.
      users.push({
        id: u.id,
        email: u.email,
        phone: u.phone,
        created_at: u.created_at,
        updated_at: u.updated_at,
        last_sign_in_at: u.last_sign_in_at,
        email_confirmed_at: u.email_confirmed_at,
        phone_confirmed_at: u.phone_confirmed_at,
        confirmed_at: u.confirmed_at,
        invited_at: u.invited_at,
        banned_until: (u as { banned_until?: string }).banned_until ?? null,
        is_anonymous: (u as { is_anonymous?: boolean }).is_anonymous ?? false,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
        identities: (u.identities ?? []).map((i) => ({
          provider: i.provider,
          id: i.id,
          identity_id: (i as { identity_id?: string }).identity_id,
          created_at: i.created_at,
          updated_at: i.updated_at,
          last_sign_in_at: i.last_sign_in_at,
          identity_data: i.identity_data,
        })),
      });
    }
    if (batch.length < PAGE_SIZE) break;
    page += 1;
  }
  return users;
}

async function fetchStorageInventory(admin: ReturnType<typeof createClient>) {
  const { data: buckets, error } = await admin.storage.listBuckets();
  if (error) throw new Error(`[storage.buckets] ${error.message}`);
  const inventory: Array<Record<string, unknown>> = [];
  for (const b of buckets ?? []) {
    const objects: Array<Record<string, unknown>> = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error: listErr } = await admin.storage
        .from(b.name)
        .list(undefined, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      if (listErr) throw new Error(`[storage.${b.name}] ${listErr.message}`);
      const batch = (data ?? []) as unknown as Array<Record<string, unknown>>;
      objects.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }
    inventory.push({ bucket: b, objects });
  }
  return inventory;
}

export const Route = createFileRoute("/api/admin/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !SERVICE_ROLE) {
          return jsonResponse({ error: "missing_env" }, 500);
        }

        // 1) Validate caller using their bearer token (publishable client).
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.toLowerCase().startsWith("bearer ")) {
          return jsonResponse({ error: "unauthorized" }, 401);
        }
        const token = authHeader.slice(7).trim();
        if (!token) return jsonResponse({ error: "unauthorized" }, 401);

        const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
          global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userData?.user) {
          return jsonResponse({ error: "unauthorized" }, 401);
        }
        const userId = userData.user.id;

        // 2) Authorize: must be an ADMIN member of at least one workspace.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: adminMembership, error: roleErr } = await supabaseAdmin
          .from("memberships")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "ADMIN")
          .limit(1)
          .maybeSingle();
        if (roleErr) return jsonResponse({ error: "role_check_failed" }, 500);
        if (!adminMembership) return jsonResponse({ error: "forbidden" }, 403);

        // 3) Build the ZIP (read-only).
        const zip = new JSZip();
        const generatedAt = new Date().toISOString();
        const manifest: Record<string, unknown> = {
          generated_at: generatedAt,
          generated_by: { id: userId, email: userData.user.email },
          project_url: SUPABASE_URL,
          tables: {} as Record<string, number>,
          auth_users: 0,
          storage_buckets: 0,
        };

        // Public schema tables
        for (const table of PUBLIC_TABLES) {
          const rows = await fetchAllRows(supabaseAdmin as unknown as ReturnType<typeof createClient>, table);
          zip.folder("tables")!.file(`${table}.json`, JSON.stringify(rows, null, 2));
          manifest.tables = { ...(manifest.tables as Record<string, number>), [table]: rows.length };
        }

        // Auth users
        const authUsers = await fetchAllAuthUsers(supabaseAdmin as unknown as ReturnType<typeof createClient>);
        zip.file("auth/users.json", JSON.stringify(authUsers, null, 2));
        manifest.auth_users = authUsers.length;

        // Storage
        const storage = await fetchStorageInventory(
          supabaseAdmin as unknown as ReturnType<typeof createClient>,
        );
        zip.file("storage/inventory.json", JSON.stringify(storage, null, 2));
        manifest.storage_buckets = storage.length;

        zip.file("manifest.json", JSON.stringify(manifest, null, 2));

        const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
        const filename = `lovable-export-${generatedAt.replace(/[:.]/g, "-")}.zip`;

        return new Response(bytes as unknown as BodyInit, {
          status: 200,
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${filename}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
