/**
 * Single source of truth for HTTP calls. Swap BASE_URL with the real API origin
 * (and remove installMockApi from the entry) to go to production.
 *
 * Auth: a token provider is installed at boot by AuthProvider. Every request
 * automatically gets `Authorization: Bearer <token>`. A 401 triggers the
 * registered onUnauthorized handler so the app can redirect to /login.
 */
import type {
  AuthResponse,
  AuthUser,
  Conversation,
  Message,
  TeamMember,
  UserRole,
  Workspace,
} from "./types";

const BASE_URL = "https://mock.api";

let tokenProvider: () => string | null = () => null;
let onUnauthorized: () => void = () => {};

export function setTokenProvider(fn: () => string | null) {
  tokenProvider = fn;
}
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenProvider();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = res.statusText;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.error || msg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // Inbox
  listConversations: () => request<Conversation[]>("/conversations"),
  listMessages: (conversationId: string) =>
    request<Message[]>(`/messages?conversationId=${encodeURIComponent(conversationId)}`),
  sendMessage: (conversationId: string, content: string) =>
    request<Message>("/messages/send", {
      method: "POST",
      body: JSON.stringify({ conversationId, content }),
    }),
  assignConversation: (conversationId: string) =>
    request<Conversation>("/conversations/assign", {
      method: "POST",
      body: JSON.stringify({ conversationId }),
    }),

  // Auth
  login: (email: string, password: string) =>
    request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  me: () => request<AuthUser>("/me"),

  // Workspace
  getWorkspace: () => request<Workspace | null>("/workspace"),
  createWorkspace: (name: string) =>
    request<Workspace>("/workspace", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  // Team
  listUsers: () => request<TeamMember[]>("/users"),
  inviteUser: (email: string, role: UserRole) =>
    request<TeamMember>("/invite-user", {
      method: "POST",
      body: JSON.stringify({ email, role }),
    }),
  updateUserRole: (userId: string, role: UserRole) =>
    request<TeamMember>("/users/role", {
      method: "PATCH",
      body: JSON.stringify({ userId, role }),
    }),
  removeUser: (userId: string) =>
    request<{ ok: true }>(`/users/${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),
};
