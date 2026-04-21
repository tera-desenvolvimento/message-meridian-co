/**
 * Mock backend that simulates the real HTTP API.
 * It intercepts fetch() calls to /conversations, /messages, /messages/send, /conversations/assign.
 *
 * To switch to a real backend later: remove the installMockApi() call in main entry
 * and point http.ts BASE_URL to your real API.
 */
import type { Conversation, Message } from "./types";

const ME = { id: "user-1", name: "Você" };

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
    assignedTo: { id: "user-1", name: "Você" },
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
  c3: [
    { id: "m7", conversationId: "c3", content: "Obrigado pelo atendimento!", fromMe: false, senderName: "João Pedro", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  ],
  c4: [
    { id: "m8", conversationId: "c4", content: "Ainda preciso da fatura, podem enviar?", fromMe: false, senderName: "Beatriz Lima", createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
  ],
  c5: [
    { id: "m9", conversationId: "c5", content: "Rafa: fechou com a Distribuidora Sul!", fromMe: false, senderName: "Rafael Nunes", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString() },
  ],
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

  await delay(120 + Math.random() * 180);

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
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const { conversationId, content } = body as { conversationId: string; content: string };
    if (!conversationId || !content?.trim()) return jsonResponse({ error: "invalid" }, 400);

    const msg: Message = {
      id: `m${Date.now()}`,
      conversationId,
      content: content.trim(),
      fromMe: true,
      senderName: ME.name,
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
    const body = init?.body ? JSON.parse(init.body as string) : {};
    const { conversationId } = body as { conversationId: string };
    const conv = conversations.find((c) => c.id === conversationId);
    if (!conv) return jsonResponse({ error: "not found" }, 404);
    conv.assignedTo = ME;
    if (conv.status === "PENDING") conv.status = "OPEN";
    return jsonResponse(conv);
  }

  return jsonResponse({ error: "not found" }, 404);
}

// Periodically simulate inbound messages so polling has something to show.
function startInboundSimulation() {
  setInterval(() => {
    const candidates = conversations.filter((c) => c.status !== "CLOSED");
    if (!candidates.length) return;
    if (Math.random() > 0.35) return;
    const conv = candidates[Math.floor(Math.random() * candidates.length)];
    const samples = [
      "Ainda está aí?",
      "Obrigado!",
      "Pode confirmar o valor?",
      "Vou aguardar então 🙏",
      "Recebi, muito obrigado.",
    ];
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
}
