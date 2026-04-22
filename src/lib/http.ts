/**
 * Supabase-backed API. Keeps the same `api` shape the UI was already using
 * (so components don't need to change), but every call now hits Supabase.
 *
 * Auth is handled by Supabase sessions (see auth-context.tsx). RLS in the
 * database enforces per-workspace isolation — the frontend never trusts
 * its own filters.
 */
import { supabase } from "@/integrations/supabase/client";
import { sendTransactionalEmail } from "@/lib/email/send";
import type {
  AuthResponse,
  AuthUser,
  Conversation,
  Invitation,
  Message,
  TeamMember,
  UserRole,
  Workspace,
} from "./types";

// ----- helpers -----

function createAuthRequiredError() {
  const error = new Error("Sua sessão expirou. Faça login novamente.");
  error.name = "AuthRequiredError";
  return error;
}

async function getSessionUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw createAuthRequiredError();
  return data.user.id;
}

async function getCurrentMembership() {
  const uid = await getSessionUserId();
  const { data, error } = await supabase
    .from("memberships")
    .select("id, workspace_id, role")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data; // may be null (no workspace yet)
}

async function requireWorkspaceId(): Promise<string> {
  const m = await getCurrentMembership();
  if (!m) throw new Error("No workspace");
  return m.workspace_id;
}

function mapConversation(row: {
  id: string;
  type: "PRIVATE" | "GROUP";
  name: string;
  external_id?: string | null;
  last_message: string;
  last_message_at: string;
  status: "OPEN" | "PENDING" | "CLOSED";
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT" | null;
  assigned_to: string | null;
  avatar_url?: string | null;
  assignee?: { id: string; name: string } | null;
  awaiting_reply_since?: string | null;
}): Conversation {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    externalId: row.external_id ?? null,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    status: row.status,
    priority: (row.priority ?? "NORMAL") as Conversation["priority"],
    assignedTo: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
    avatarUrl: row.avatar_url ?? null,
    awaitingReplySince: row.awaiting_reply_since ?? null,
  };
}

function mapMessage(row: {
  id: string;
  conversation_id: string;
  content: string;
  from_me: boolean;
  sender_name: string;
  sender_avatar_url?: string | null;
  created_at: string;
  media_url?: string | null;
  media_mime_type?: string | null;
  media_type?: string | null;
}): Message {
  const mediaType = (row.media_type ?? null) as Message["mediaType"];
  return {
    id: row.id,
    conversationId: row.conversation_id,
    content: row.content,
    fromMe: row.from_me,
    senderName: row.sender_name,
    senderAvatarUrl: row.sender_avatar_url ?? null,
    createdAt: row.created_at,
    type: mediaType === "image" ? "image" : mediaType === "audio" ? "audio" : "text",
    mediaUrl: row.media_url ?? null,
    mediaMimeType: row.media_mime_type ?? null,
    mediaType,
  };
}

const MESSAGE_COLUMNS =
  "id, conversation_id, content, from_me, sender_name, sender_avatar_url, created_at, media_url, media_mime_type, media_type";

// ----- API surface -----

export const api = {
  // ---------- Inbox ----------
  async listConversations(): Promise<Conversation[]> {
    const wsId = await requireWorkspaceId();
    return manualListConversations(wsId);
  },

  async listMessages(conversationId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from("messages")
      .select(MESSAGE_COLUMNS)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return (data ?? []).map(mapMessage);
  },

  async sendMessage(conversationId: string, content: string): Promise<Message> {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    if (!accessToken) throw createAuthRequiredError();

    const res = await fetch("/api/whapi/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ conversationId, content }),
    });

    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // ignore parse errors
    }

    if (!res.ok) {
      const msg = json?.error || `Falha ao enviar mensagem (HTTP ${res.status})`;
      throw new Error(msg);
    }

    if (json?.deduped) {
      // Webhook already inserted the echo; fetch the most recent outgoing message.
      const { data } = await supabase
        .from("messages")
        .select(MESSAGE_COLUMNS)
        .eq("conversation_id", conversationId)
        .eq("from_me", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return mapMessage(data);
    }

    const m = json.message;
    return {
      id: m.id,
      conversationId: m.conversationId,
      content: m.content,
      fromMe: m.fromMe,
      senderName: m.senderName,
      senderAvatarUrl: m.senderAvatarUrl ?? null,
      createdAt: m.createdAt,
      type: "text",
      mediaUrl: null,
      mediaMimeType: null,
      mediaType: null,
    };
  },

  async assignConversation(conversationId: string, userId?: string): Promise<Conversation> {
    const uid = userId ?? (await getSessionUserId());
    const { data, error } = await supabase
      .from("conversations")
      .update({ assigned_to: uid, status: "OPEN" })
      .eq("id", conversationId)
      .select(
        "id, type, name, external_id, last_message, last_message_at, status, priority, assigned_to, avatar_url",
      )
      .single();
    if (error) throw error;
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, name")
      .eq("id", uid)
      .maybeSingle();
    return mapConversation({ ...data, assignee: prof ?? null });
  },

  async unassignConversation(conversationId: string): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .update({ assigned_to: null })
      .eq("id", conversationId)
      .select(
        "id, type, name, external_id, last_message, last_message_at, status, priority, assigned_to, avatar_url",
      )
      .single();
    if (error) throw error;
    return mapConversation({ ...data, assignee: null });
  },

  async setConversationStatus(
    conversationId: string,
    status: "OPEN" | "PENDING" | "CLOSED",
  ): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .update({ status })
      .eq("id", conversationId)
      .select(
        "id, type, name, external_id, last_message, last_message_at, status, priority, assigned_to, avatar_url",
      )
      .single();
    if (error) throw error;
    let assignee = null as { id: string; name: string } | null;
    if (data.assigned_to) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", data.assigned_to)
        .maybeSingle();
      assignee = prof ?? null;
    }
    return mapConversation({ ...data, assignee });
  },

  async setConversationPriority(
    conversationId: string,
    priority: "LOW" | "NORMAL" | "HIGH" | "URGENT",
  ): Promise<Conversation> {
    const { data, error } = await supabase
      .from("conversations")
      .update({ priority })
      .eq("id", conversationId)
      .select(
        "id, type, name, external_id, last_message, last_message_at, status, priority, assigned_to, avatar_url",
      )
      .single();
    if (error) throw error;
    let assignee = null as { id: string; name: string } | null;
    if (data.assigned_to) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("id", data.assigned_to)
        .maybeSingle();
      assignee = prof ?? null;
    }
    return mapConversation({ ...data, assignee });
  },

  async deleteConversation(conversationId: string): Promise<{ ok: true }> {
    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationId);
    if (error) throw error;
    return { ok: true };
  },

  // ---------- Auth ----------
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) throw new Error("No session returned");
    const user = await api.me();
    return { token: data.session.access_token, user };
  },

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) throw new Error(error.message);
    if (!data.session) {
      // Email confirmation likely required; we still return a placeholder.
      throw new Error(
        "Conta criada. Verifique seu e-mail para confirmar (ou desative confirmação no Cloud).",
      );
    }
    const user = await api.me();
    return { token: data.session.access_token, user };
  },

  async me(): Promise<AuthUser> {
    const { data: sess } = await supabase.auth.getSession();
    const sUser = sess.session?.user;
    if (!sUser) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", sUser.id)
      .maybeSingle();

    const membership = await getCurrentMembership();

    return {
      id: sUser.id,
      email: sUser.email ?? "",
      name: profile?.name || sUser.email?.split("@")[0] || "User",
      role: (membership?.role as UserRole) ?? "AGENT",
      workspaceId: membership?.workspace_id ?? null,
    };
  },

  // ---------- Workspace ----------
  async getWorkspace(): Promise<Workspace | null> {
    const m = await getCurrentMembership();
    if (!m) return null;
    const { data, error } = await supabase
      .from("workspaces")
      .select("id, name, created_at")
      .eq("id", m.workspace_id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { id: data.id, name: data.name, createdAt: data.created_at };
  },

  async createWorkspace(name: string): Promise<Workspace> {
    const workspaceId = crypto.randomUUID();
    const creatorId = await getSessionUserId();

    const { error: workspaceError } = await supabase
      .from("workspaces")
      .insert({ id: workspaceId, name, created_by: creatorId } as never);
    if (workspaceError) {
      throw new Error("Não foi possível criar o workspace. Verifique os dados e tente novamente.");
    }

    const { error: membershipError } = await supabase
      .from("memberships")
      .upsert(
        { user_id: creatorId, workspace_id: workspaceId, role: "ADMIN" },
        { onConflict: "user_id,workspace_id", ignoreDuplicates: true },
      );
    if (membershipError) {
      throw new Error("Workspace criado, mas não foi possível vincular seu usuário. Tente novamente.");
    }

    const { data: ws, error: selectError } = await supabase
      .from("workspaces")
      .select("id, name, created_at")
      .eq("id", workspaceId)
      .single();

    if (selectError) {
      throw new Error("Workspace criado, mas não foi possível carregar os dados. Recarregue a página.");
    }

    return { id: ws.id, name: ws.name, createdAt: ws.created_at };
  },

  // ---------- Team ----------
  async listUsers(): Promise<TeamMember[]> {
    const wsId = await requireWorkspaceId();
    return manualListUsers(wsId);
  },

  async createInvitation(email: string | null, role: UserRole): Promise<Invitation> {
    const wsId = await requireWorkspaceId();
    const uid = await getSessionUserId();
    const token = generateInviteToken();
    const { data, error } = await supabase
      .from("invitations")
      .insert({
        workspace_id: wsId,
        email: email && email.trim() ? email.trim().toLowerCase() : null,
        role,
        token,
        created_by: uid,
      })
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return mapInvitation(data);
  },

  async sendInvitationEmail(
    invitation: Invitation,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!invitation.email) {
      return { ok: false, error: "Convite sem e-mail definido." };
    }
    // Look up workspace name + inviter name for the email body.
    const wsId = await requireWorkspaceId();
    const uid = await getSessionUserId();
    const [{ data: ws }, { data: prof }] = await Promise.all([
      supabase.from("workspaces").select("name").eq("id", wsId).maybeSingle(),
      supabase.from("profiles").select("name").eq("id", uid).maybeSingle(),
    ]);
    return sendTransactionalEmail({
      templateName: "team-invitation",
      recipientEmail: invitation.email,
      idempotencyKey: `team-invite-${invitation.id}`,
      templateData: {
        workspaceName: ws?.name ?? "sua equipe",
        inviterName: prof?.name ?? undefined,
        role: invitation.role,
        inviteUrl: invitation.inviteUrl,
      },
    });
  },


  async listInvitations(): Promise<Invitation[]> {
    const wsId = await requireWorkspaceId();
    const { data, error } = await supabase
      .from("invitations")
      .select("id, email, role, token, expires_at, accepted_at, created_at")
      .eq("workspace_id", wsId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(mapInvitation);
  },

  async revokeInvitation(id: string): Promise<{ ok: true }> {
    const { error } = await supabase.from("invitations").delete().eq("id", id);
    if (error) throw error;
    return { ok: true };
  },

  async updateUserRole(userId: string, role: UserRole): Promise<TeamMember> {
    const wsId = await requireWorkspaceId();
    const { data, error } = await supabase
      .from("memberships")
      .update({ role })
      .eq("workspace_id", wsId)
      .eq("user_id", userId)
      .select("user_id, role, created_at, active")
      .single();
    if (error) throw error;
    const { data: prof } = await supabase
      .from("profiles")
      .select("name, email")
      .eq("id", userId)
      .maybeSingle();
    const active = (data as { active?: boolean }).active ?? true;
    return {
      id: data.user_id,
      name: prof?.name || "—",
      email: prof?.email || "",
      role: data.role as UserRole,
      status: active ? "ACTIVE" : "DISABLED",
      active,
      joinedAt: data.created_at,
    };
  },

  async updateMemberActive(userId: string, active: boolean): Promise<{ ok: true }> {
    const wsId = await requireWorkspaceId();
    const { error } = await supabase
      .from("memberships")
      .update({ active } as never)
      .eq("workspace_id", wsId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  },

  async updateMemberName(userId: string, name: string): Promise<{ ok: true }> {
    const { error } = await supabase
      .from("profiles")
      .update({ name })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  },

  async updateOwnProfile(input: { name?: string; signature?: string | null }): Promise<{ ok: true }> {
    const uid = await getSessionUserId();
    const patch: { name?: string; signature?: string | null } = {};
    if (typeof input.name === "string") patch.name = input.name;
    if (input.signature !== undefined) {
      const sig = (input.signature ?? "").trim();
      patch.signature = sig.length ? sig : null;
    }
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", uid);
    if (error) throw error;
    return { ok: true };
  },

  async getOwnProfile(): Promise<{ name: string; signature: string }> {
    const uid = await getSessionUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("name, signature")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    return { name: data?.name ?? "", signature: (data?.signature as string | null) ?? "" };
  },

  async updateOwnPassword(newPassword: string): Promise<{ ok: true }> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  },

  async startConversation(
    phone: string,
    name: string,
  ): Promise<{ id: string; name: string; created: boolean }> {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    if (!accessToken) throw createAuthRequiredError();

    const res = await fetch("/api/whapi/start-conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ phone, name }),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }
    if (!res.ok) {
      throw new Error(json?.error || `Falha ao iniciar conversa (HTTP ${res.status})`);
    }
    return {
      id: json.conversation.id,
      name: json.conversation.name,
      created: !!json.created,
    };
  },

  /**
   * Best-effort backfill of WhatsApp profile pictures for the current
   * workspace. Safe to call on app load — server caps the work per call
   * and skips conversations whose avatars are still fresh.
   */
  async refreshAvatars(): Promise<{ refreshed: number; skipped: number }> {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    if (!accessToken) return { refreshed: 0, skipped: 0 };
    try {
      const res = await fetch("/api/whapi/refresh-avatars", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { refreshed: 0, skipped: 0 };
      const json = (await res.json()) as { refreshed?: number; skipped?: number };
      return { refreshed: json.refreshed ?? 0, skipped: json.skipped ?? 0 };
    } catch {
      return { refreshed: 0, skipped: 0 };
    }
  },

  async removeUser(userId: string): Promise<{ ok: true }> {
    const wsId = await requireWorkspaceId();
    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("workspace_id", wsId)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  },

  /**
   * Add an existing platform user to the current workspace by e-mail.
   * Requires the caller to be ADMIN. The target user must already have a
   * registered account (we look them up by their profile e-mail).
   */
  /**
   * Join an existing workspace using the team code (workspace id) shared by
   * an admin. Adds the current user as an ACTIVE AGENT.
   */
  async joinWorkspaceByCode(code: string): Promise<Workspace> {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    if (!accessToken) throw createAuthRequiredError();

    const res = await fetch("/api/team/join-by-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ code }),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }
    if (!res.ok) {
      throw new Error(json?.error || `Falha ao entrar na equipe (HTTP ${res.status})`);
    }
    return {
      id: json.workspace.id,
      name: json.workspace.name,
      createdAt: json.workspace.createdAt,
    };
  },

  async addExistingUserByEmail(
    email: string,
    role: UserRole,
  ): Promise<{
    ok: true;
    reactivated?: boolean;
    user: { id: string; name: string; email: string };
  }> {
    const { data: sess } = await supabase.auth.getSession();
    const accessToken = sess.session?.access_token;
    if (!accessToken) throw createAuthRequiredError();

    const res = await fetch("/api/team/add-member", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ email, role }),
    });
    let json: any = null;
    try {
      json = await res.json();
    } catch {
      // ignore
    }
    if (!res.ok) {
      const err = new Error(json?.error || `Falha ao adicionar membro (HTTP ${res.status})`);
      (err as any).code = json?.code;
      throw err;
    }
    return json;
  },
};

// ---- fallbacks when PostgREST relationship hints fail ----

async function manualListConversations(wsId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, type, name, external_id, last_message, last_message_at, status, priority, assigned_to, avatar_url")
    .eq("workspace_id", wsId)
    .order("last_message_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  const assigneeIds = Array.from(
    new Set(rows.map((r) => r.assigned_to).filter((x): x is string => !!x)),
  );
  let profileMap = new Map<string, string>();
  if (assigneeIds.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", assigneeIds);
    profileMap = new Map((profs ?? []).map((p) => [p.id, p.name]));
  }

  // Para cada conversa, descobre se a última mensagem foi do cliente (from_me=false).
  // Caso afirmativo, registramos quando ela chegou para indicar há quanto tempo
  // estamos sem responder. Limitamos a 200 conversas por consulta para evitar
  // payloads enormes.
  const awaitingMap = new Map<string, string>();
  const convIds = rows.slice(0, 200).map((r) => r.id);
  if (convIds.length) {
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, from_me, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false });
    if (msgs) {
      const seen = new Set<string>();
      for (const m of msgs as Array<{
        conversation_id: string;
        from_me: boolean;
        created_at: string;
      }>) {
        if (seen.has(m.conversation_id)) continue;
        seen.add(m.conversation_id);
        if (!m.from_me) {
          awaitingMap.set(m.conversation_id, m.created_at);
        }
      }
    }
  }

  return rows.map((r) =>
    mapConversation({
      ...r,
      assignee: r.assigned_to
        ? { id: r.assigned_to, name: profileMap.get(r.assigned_to) ?? "—" }
        : null,
      awaiting_reply_since: awaitingMap.get(r.id) ?? null,
    }),
  );
}

async function manualListUsers(wsId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, created_at, active")
    .eq("workspace_id", wsId);
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    user_id: string;
    role: string;
    created_at: string;
    active?: boolean;
  }>;
  const ids = rows.map((r) => r.user_id);
  let profiles = new Map<string, { name: string; email: string }>();
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", ids);
    profiles = new Map(
      ((profs ?? []) as Array<{ id: string; name: string; email: string | null }>).map((p) => [
        p.id,
        { name: p.name, email: p.email ?? "" },
      ]),
    );
  }
  return rows.map((r) => {
    const active = r.active ?? true;
    const prof = profiles.get(r.user_id);
    return {
      id: r.user_id,
      name: prof?.name || "—",
      email: prof?.email || "",
      role: r.role as UserRole,
      status: active ? ("ACTIVE" as const) : ("DISABLED" as const),
      active,
      joinedAt: r.created_at,
    };
  });
}

function generateInviteToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function mapInvitation(row: {
  id: string;
  email: string | null;
  role: string;
  token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}): Invitation {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    token: row.token,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    createdAt: row.created_at,
    inviteUrl: `${origin}/accept-invite?token=${row.token}`,
  };
}

// Kept for backward compatibility with old code that imported these.
export function setTokenProvider(_fn: () => string | null) {
  void _fn;
}
export function setUnauthorizedHandler(_fn: () => void) {
  void _fn;
}
