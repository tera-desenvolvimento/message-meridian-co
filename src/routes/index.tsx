import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/http";
import { installMockApi } from "@/lib/mock-api";
import type { Conversation, Message } from "@/lib/types";
import { usePolling } from "@/hooks/usePolling";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatArea } from "@/components/inbox/ChatArea";

// Install the mock API once on the client. Remove this line and point
// src/lib/http.ts BASE_URL to your real backend to go live.
if (typeof window !== "undefined") installMockApi();

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inbox CRM — Atendimento WhatsApp" },
      { name: "description", content: "CRM de atendimento via WhatsApp com múltiplos atendentes." },
    ],
  }),
  component: InboxPage,
});

function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await api.listConversations();
      setConversations(list);
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  const refreshMessages = useCallback(
    async (silent = false) => {
      if (!selectedId) return;
      if (!silent) setLoadingMsgs(true);
      try {
        const list = await api.listMessages(selectedId);
        setMessages(list);
      } catch (e) {
        console.error("Failed to load messages", e);
      } finally {
        if (!silent) setLoadingMsgs(false);
      }
    },
    [selectedId],
  );

  // Poll conversations every 4s
  usePolling(refreshConversations, 4000, true);

  // When selection changes, load messages immediately
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void refreshMessages(false);
  }, [selectedId, refreshMessages]);

  // Poll messages of the active conversation every 3s (silent)
  usePolling(() => refreshMessages(true), 3000, !!selectedId);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Mobile: show list OR chat. Desktop: both.
  const showChatOnMobile = !!selectedId;

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      <div
        className={`${showChatOnMobile ? "hidden" : "flex"} h-full w-full md:flex md:w-auto md:shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          loading={loadingConvs}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </div>

      <div className={`${showChatOnMobile ? "flex" : "hidden"} h-full min-w-0 flex-1 md:flex`}>
        <ChatArea
          conversation={selected}
          messages={messages}
          loadingMessages={loadingMsgs}
          onSent={() => {
            void refreshMessages(true);
            void refreshConversations();
          }}
          onAssigned={() => {
            void refreshConversations();
          }}
          onBack={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
