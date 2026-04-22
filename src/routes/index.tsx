import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/http";
import type { Conversation, Message } from "@/lib/types";
import { usePolling } from "@/hooks/usePolling";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatArea } from "@/components/inbox/ChatArea";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inbox — Crmly" },
      { name: "description", content: "Inbox de atendimento multiempresa." },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  return (
    <AuthGuard>
      <InboxShell />
    </AuthGuard>
  );
}

function InboxShell() {
  const { isAuthenticated, user } = useAuth();
  // Don't fetch inbox until authenticated and workspace assigned.
  const ready = isAuthenticated && !!user?.workspaceId;
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <AppHeader />
      <div className="flex min-h-0 flex-1">{ready && <Inbox />}</div>
    </div>
  );
}

function Inbox() {
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

  usePolling(refreshConversations, 8000, true);

  // On mount, kick off a best-effort avatar backfill via Whapi.
  // Server is rate-limited (max 30 per call, only stale/missing).
  useEffect(() => {
    void api.refreshAvatars().then((r) => {
      if (r.refreshed > 0) void refreshConversations();
    });
  }, [refreshConversations]);

  // Realtime: refresh conversations on any change
  useEffect(() => {
    const channel = supabase
      .channel("conversations-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => void refreshConversations(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshConversations]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void refreshMessages(false);
  }, [selectedId, refreshMessages]);

  // Realtime: new messages in selected conversation
  useEffect(() => {
    if (!selectedId) return;
    const channel = supabase
      .channel(`messages-${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        () => void refreshMessages(true),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedId, refreshMessages]);

  usePolling(() => refreshMessages(true), 6000, !!selectedId);

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const showChatOnMobile = !!selectedId;

  return (
    <div className="flex w-full overflow-hidden">
      <div
        className={`${showChatOnMobile ? "hidden" : "flex"} h-full w-full md:flex md:w-auto md:shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          loading={loadingConvs}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onConversationCreated={(id) => {
            void refreshConversations();
            setSelectedId(id);
          }}
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
          onDeleted={() => {
            setSelectedId(null);
            void refreshConversations();
          }}
          onBack={() => setSelectedId(null)}
        />
      </div>
    </div>
  );
}
