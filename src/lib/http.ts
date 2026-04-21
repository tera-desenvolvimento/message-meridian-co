/**
 * Supabase-backed API. Keeps the same `api` shape the UI was already using
 * (so components don't need to change), but every call now hits Supabase.
 *
 * Auth is handled by Supabase sessions (see auth-context.tsx). RLS in the
 * database enforces per-workspace isolation — the frontend never trusts
 * its own filters.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AuthResponse,
  AuthUser,
  Conversation,
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
  last_message: string;
  last_message_at: string;
  status: "OPEN" | "PENDING" | "CLOSED";
  assigned_to: string | null;
  assignee?: { id: string; name: string } | null;
}): Conversation {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    lastMessage: row.last_message,
    lastMessageAt: row.last_message_at,
    status: row.status,
    assignedTo: row.assignee ? { id: row.assignee.id, name: row.assignee.name } : null,
  };
}

function mapMessage(row: {
  id: string;
  conversation_id: string;
  content: string;
  from_me: boolean;
  sender_name: string;
  created_at: string;
}): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    content: row.content,
    fromMe: row.from_me,
    senderName: row.sender_name,
    createdAt: row.created_at,
    type: "text",
  };
}

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
      .select("id, conversation_id, content, from_me, sender_name, created_at")
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
        .select("id, conversation_id, content, from_me, sender_name, created_at")
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
      createdAt: m.createdAt,
      type: "text",
    };
  },

  async assignConversation(conversationId: string): Promise<Conversation> {
    const uid = await getSessionUserId();
    const { data, error } = await supabase
      .from("conversations")
      .update({ assigned_to: uid, status: "OPEN" })
      .eq("id", conversationId)
      .select(
        "id, type, name, last_message, last_message_at, status, assigned_to",
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

  async inviteUser(email: string, _role: UserRole): Promise<TeamMember> {
    // True invitations require a server function with the service-role key.
    // For now we surface a clear message so admins know what's needed.
    void _role;
    throw new Error(
      `Convites por e-mail exigem uma função no servidor. Peça ao usuário (${email}) para criar uma conta e depois adicione-o ao workspace.`,
    );
  },

  async updateUserRole(userId: string, role: UserRole): Promise<TeamMember> {
    const wsId = await requireWorkspaceId();
    const { data, error } = await supabase
      .from("memberships")
      .update({ role })
      .eq("workspace_id", wsId)
      .eq("user_id", userId)
      .select("user_id, role, created_at")
      .single();
    if (error) throw error;
    const { data: prof } = await supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle();
    return {
      id: data.user_id,
      name: prof?.name || "—",
      email: "",
      role: data.role as UserRole,
      status: "ACTIVE",
      joinedAt: data.created_at,
    };
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
};

// ---- fallbacks when PostgREST relationship hints fail ----

async function manualListConversations(wsId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, type, name, last_message, last_message_at, status, assigned_to")
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
  return rows.map((r) =>
    mapConversation({
      ...r,
      assignee: r.assigned_to
        ? { id: r.assigned_to, name: profileMap.get(r.assigned_to) ?? "—" }
        : null,
    }),
  );
}

async function manualListUsers(wsId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select("user_id, role, created_at")
    .eq("workspace_id", wsId);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((r) => r.user_id);
  let names = new Map<string, string>();
  if (ids.length) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name")
      .in("id", ids);
    names = new Map((profs ?? []).map((p) => [p.id, p.name]));
  }
  return rows.map((r) => ({
    id: r.user_id,
    name: names.get(r.user_id) || "—",
    email: "",
    role: r.role as UserRole,
    status: "ACTIVE" as const,
    joinedAt: r.created_at,
  }));
}

// Kept for backward compatibility with old code that imported these.
export function setTokenProvider(_fn: () => string | null) {
  void _fn;
}
export function setUnauthorizedHandler(_fn: () => void) {
  void _fn;
}
