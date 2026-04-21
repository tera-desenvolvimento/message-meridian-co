/**
 * Single source of truth for HTTP calls. Swap BASE_URL with the real API origin
 * (and remove installMockApi from the entry) to go to production.
 */
import type { Conversation, Message } from "./types";

const BASE_URL = "https://mock.api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
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
};
