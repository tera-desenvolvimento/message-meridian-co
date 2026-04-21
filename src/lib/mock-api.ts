/**
 * Mock backend that simulates the real HTTP API (inbox + auth + workspace + team).
 * It intercepts fetch() calls with BASE = https://mock.api.
 *
 * To switch to a real backend later: remove the installMockApi() call in the
 * entry and point http.ts BASE_URL to your real API.
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

// ----------- In-memory data stores -----------

interface StoredUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  workspaceId: string | null;
  status: "ACTIVE" | "INVITED";
  joinedAt: string;
}

const users: StoredUser[] = [
  {
    id: "user-demo",
    name: "Demo Admin",
    email: "demo@crm.app",
    password: "demo1234",
    role: "ADMIN",
    workspaceId: "ws-demo",
    status: "ACTIVE",
    joinedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: "user-2",
    name: "Marina Souza",
    email: "marina@crm.app",
    password: "demo1234",
    role: "AGENT",
    workspaceId: "ws-demo",
    status: "ACTIVE",
    joinedAt: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  {
    id: "user-3",
    name: "Pedro Alves",
    email: "pedro@crm.app",
    password: "demo1234",
    role: "AGENT",
    workspaceId: "ws-demo",
    status: "ACTIVE",
    joinedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const workspaces: Workspace[] = [
  { id: "ws-demo", name: "Acme Demo", createdAt: new Date(Date.now() - 86400000 * 30).toISOString() },
];

// token -> userId
const tokens = new Map<string, string>();

function makeToken(userId: string): string {
  // Fake JWT-shaped token. Real backend signs this — we just opaque-stringify.
  const t = `mock.${btoa(userId)}.${Math.random().toString(36).slice(2, 10)}`;
  tokens.set(t, userId);
  return t;
}

function authedUser(init?: RequestInit): StoredUser | null {
  const headers = new Headers(init?.headers || {});
  const auth = headers.get("authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const userId = tokens.get(token);
  if (!userId) return null;
  return users.find((u) => u.id === userId) || null;
}

function toAuthUser(u: StoredUser): AuthUser {
  return { id: u.id, name: u.name, email: u.email, role: u.role, workspaceId: u.workspaceId };
}

function toTeamMember(u: StoredUser): TeamMember {
  return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, joinedAt: u.joinedAt };
}

// ----------- Inbox data -----------

const ME = { id: "user-demo", name: "Você" };

let conversations: Conversation[] = [
  {
    id: "c1",
    type: "PRIVATE",
    name: "Ana Martins",
    lastMessage: "Boa tarde! Vocês entregam em SP?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
    status: "OPEN",
    assignedTo: null,
  },
  {
    id: "c2",
    type: "GROUP",
    name: "Equipe Suporte • Cliente Acme",
    lastMessage: "Carlos: pode validar o ticket #482?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    status: "PENDING",
    assignedTo: { id: "user-2", name: "Marina Souza" },
  },
  {
    id: "c3",
    type: "PRIVATE",
    name: "João Pedro",
    lastMessage: "Obrigado pelo atendimento!",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    status: "CLOSED",
    assignedTo: { id: "user-demo", name: "Você" },
  },
  {
    id: "c4",
    type: "PRIVATE",
    name: "Beatriz Lima",
    lastMessage: "Ainda preciso da fatura, podem enviar?",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    status: "OPEN",
    assignedTo: null,
  },
  {
    id: "c5",
    type: "GROUP",
    name: "Vendas • Setor Norte",
    lastMessage: "Rafa: fechou com a Distribuidora Sul!",
    lastMessageAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    status: "OPEN",
    assignedTo: { id: "user-3", name: "Pedro Alves" },
  },
];

const messages: Record<string, Message[]> = {
  c1: [
    { id: "m1", conversationId: "c1", content: "Olá, tudo bem?", fromMe: false, senderName: "Ana Martins", createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString() },
    { id: "m2", conversationId: "c1", content: "Olá Ana! Tudo ótimo, como posso ajudar?", fromMe: true, senderName: "Você", createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
    { id: "m3", conversationId: "c1", content: "Boa tarde! Vocês entregam em SP?", fromMe: false, senderName: "Ana Martins", createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
  ],
  c2: [
    { id: "m4", conversationId: "c2", content: "Bom dia pessoal", fromMe: false, senderName: "Marina Souza", createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
    { id: "m5", conversationId: "c2", content: "Bom dia Marina!", fromMe: true, senderName: "Você", createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString() },
    { id: "m6", conversationId: "c2", content: "Carlos: pode validar o ticket #482?", fromMe: false, senderName: "Carlos Dias", createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString() },
  ],
  c3: [{ id: "m7", conversationId: "c3", content: "Obrigado pelo atendimento!", fromMe: false, senderName: "João Pedro", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() }],
  c4: [{ id: "m8", conversationId: "c4", content: "Ainda preciso da fatura, podem enviar?", fromMe: false, senderName: "Beatriz Lima", createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() }],
  c5: [{ id: "m9", conversationId: "c5", content: "Rafa: fechou com a Distribuidora Sul!", fromMe: false, senderName: "Rafael Nunes", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() }],
};

let installed = false;
const realFetch = typeof window !== "undefined" ? window.fetch.bind(window) : fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function handle(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method || "GET").toUpperCase();
  const path = url.pathname;
  const body = init?.body ? JSON.parse(init.body as string) : {};

  await delay(120 + Math.random() * 180);

  // ---------- AUTH (public) ----------
  if (method === "POST" && path === "/auth/login") {
    const { email, password } = body as { email: string; password: string };
    const u = users.find((x) => x.email.toLowerCase() === (email || "").toLowerCase());
    if (!u || u.password !== password) return jsonResponse({ error: "Credenciais inválidas" }, 401);
    const token = makeToken(u.id);
    return jsonResponse<AuthResponse>({ token, user: toAuthUser(u) });
  }

  if (method === "POST" && path === "/auth/register") {
    const { name, email, password } = body as { name: string; email: string; password: string };
    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return jsonResponse({ error: "Dados inválidos (senha mínima 6 caracteres)" }, 400);
    }
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return jsonResponse({ error: "E-mail já cadastrado" }, 409);
    }
    const u: StoredUser = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      role: "ADMIN",
      workspaceId: null,
      status: "ACTIVE",
      joinedAt: new Date().toISOString(),
    };
    users.push(u);
    const token = makeToken(u.id);
    return jsonResponse<AuthResponse>({ token, user: toAuthUser(u) });
  }

  // ---------- AUTHED ----------
  const me = authedUser(init);
  if (!me) return jsonResponse({ error: "Unauthorized" }, 401);

  if (method === "GET" && path === "/me") {
    return jsonResponse(toAuthUser(me));
  }

  if (method === "GET" && path === "/workspace") {
    if (!me.workspaceId) return jsonResponse(null);
    const ws = workspaces.find((w) => w.id === me.workspaceId) || null;
    return jsonResponse(ws);
  }

  if (method === "POST" && path === "/workspace") {
    const { name } = body as { name: string };
    if (!name?.trim()) return jsonResponse({ error: "Nome obrigatório" }, 400);
    if (me.workspaceId) return jsonResponse({ error: "Já possui workspace" }, 409);
    const ws: Workspace = {
      id: `ws-${Date.now()}`,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    };
    workspaces.push(ws);
    me.workspaceId = ws.id;
    me.role = "ADMIN";
    return jsonResponse(ws);
  }

  // ---------- TEAM (workspace-scoped) ----------
  if (!me.workspaceId) return jsonResponse({ error: "Sem workspace" }, 403);

  if (method === "GET" && path === "/users") {
    const list = users.filter((u) => u.workspaceId === me.workspaceId).map(toTeamMember);
    return jsonResponse(list);
  }

  if (method === "POST" && path === "/invite-user") {
    if (me.role !== "ADMIN") return jsonResponse({ error: "Apenas ADMIN" }, 403);
    const { email, role } = body as { email: string; role: UserRole };
    if (!email?.trim()) return jsonResponse({ error: "E-mail obrigatório" }, 400);
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase() && u.workspaceId === me.workspaceId)) {
      return jsonResponse({ error: "Usuário já está no workspace" }, 409);
    }
    const invited: StoredUser = {
      id: `user-${Date.now()}`,
      name: email.split("@")[0],
      email: email.toLowerCase(),
      password: "invite",
      role: role === "ADMIN" ? "ADMIN" : "AGENT",
      workspaceId: me.workspaceId,
      status: "INVITED",
      joinedAt: new Date().toISOString(),
    };
    users.push(invited);
    return jsonResponse(toTeamMember(invited));
  }

  if (method === "PATCH" && path === "/users/role") {
    if (me.role !== "ADMIN") return jsonResponse({ error: "Apenas ADMIN" }, 403);
    const { userId, role } = body as { userId: string; role: UserRole };
    const target = users.find((u) => u.id === userId && u.workspaceId === me.workspaceId);
    if (!target) return jsonResponse({ error: "Usuário não encontrado" }, 404);
    target.role = role === "ADMIN" ? "ADMIN" : "AGENT";
    return jsonResponse(toTeamMember(target));
  }

  if (method === "DELETE" && path.startsWith("/users/")) {
    if (me.role !== "ADMIN") return jsonResponse({ error: "Apenas ADMIN" }, 403);
    const userId = decodeURIComponent(path.replace("/users/", ""));
    if (userId === me.id) return jsonResponse({ error: "Não é possível remover a si mesmo" }, 400);
    const idx = users.findIndex((u) => u.id === userId && u.workspaceId === me.workspaceId);
    if (idx < 0) return jsonResponse({ error: "Usuário não encontrado" }, 404);
    users.splice(idx, 1);
    return jsonResponse({ ok: true });
  }

  // ---------- INBOX ----------
  if (method === "GET" && path === "/conversations") {
    const sorted = [...conversations].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
    return jsonResponse(sorted);
  }

  if (method === "GET" && path === "/messages") {
    const conversationId = url.searchParams.get("conversationId");
    if (!conversationId) return jsonResponse({ error: "conversationId required" }, 400);
    return jsonResponse(messages[conversationId] ?? []);
  }

  if (method === "POST" && path === "/messages/send") {
    const { conversationId, content } = body as { conversationId: string; content: string };
    if (!conversationId || !content?.trim()) return jsonResponse({ error: "invalid" }, 400);
    const msg: Message = {
      id: `m${Date.now()}`,
      conversationId,
      content: content.trim(),
      fromMe: true,
      senderName: me.name,
      createdAt: new Date().toISOString(),
    };
    messages[conversationId] = [...(messages[conversationId] ?? []), msg];
    const conv = conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.lastMessage = msg.content;
      conv.lastMessageAt = msg.createdAt;
      if (conv.status === "PENDING") conv.status = "OPEN";
    }
    return jsonResponse(msg);
  }

  if (method === "POST" && path === "/conversations/assign") {
    const { conversationId } = body as { conversationId: string };
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return jsonResponse({ error: "not found" }, 404);
    conv.assignedTo = { id: me.id, name: me.name };
    if (conv.status === "PENDING") conv.status = "OPEN";
    return jsonResponse(conv);
  }

  return jsonResponse({ error: "not found" }, 404);
}

function startInboundSimulation() {
  setInterval(() => {
    const candidates = conversations.filter((c) => c.status !== "CLOSED");
    if (!candidates.length) return;
    if (Math.random() > 0.35) return;
    const conv = candidates[Math.floor(Math.random() * candidates.length)];
    const samples = ["Ainda está aí?", "Obrigado!", "Pode confirmar o valor?", "Vou aguardar então 🙏", "Recebi, muito obrigado."];
    const content = samples[Math.floor(Math.random() * samples.length)];
    const senderName = conv.type === "GROUP" ? ["Carlos Dias", "Rafael Nunes", "Marina Souza"][Math.floor(Math.random() * 3)] : conv.name;
    const msg: Message = {
      id: `m${Date.now()}-${Math.random()}`,
      conversationId: conv.id,
      content,
      fromMe: false,
      senderName,
      createdAt: new Date().toISOString(),
    };
    messages[conv.id] = [...(messages[conv.id] ?? []), msg];
    conv.lastMessage = conv.type === "GROUP" ? `${senderName}: ${content}` : content;
    conv.lastMessageAt = msg.createdAt;
  }, 12000);
}

export function installMockApi() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const BASE = "https://mock.api";
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (urlStr.startsWith(BASE)) {
      const u = new URL(urlStr);
      return handle(u, init);
    }
    return realFetch(input as RequestInfo, init);
  };
  startInboundSimulation();
  // Suppress ME export warning — keep reference for future use.
  void ME;
}
