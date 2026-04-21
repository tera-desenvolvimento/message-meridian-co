import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, Send, UserPlus } from "lucide-react";
import type { Conversation, Message } from "@/lib/types";
import { api } from "@/lib/http";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  loadingMessages: boolean;
  onSent: () => void;
  onAssigned: () => void;
  onBack?: () => void;
}

export function ChatArea({ conversation, messages, loadingMessages, onSent, onAssigned, onBack }: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change or conversation changes
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, conversation?.id]);

  // Reset draft when changing conversation
  useEffect(() => {
    setDraft("");
    setError(null);
  }, [conversation?.id]);

  const isGroup = conversation?.type === "GROUP";

  const grouped = useMemo(() => {
    // Determine which messages need a sender label (groups only, and only when sender changes)
    return messages.map((m, i) => {
      const prev = messages[i - 1];
      const showSender = !!isGroup && !m.fromMe && (!prev || prev.senderName !== m.senderName || prev.fromMe);
      return { m, showSender };
    });
  }, [messages, isGroup]);

  if (!conversation) {
    return (
      <section className="hidden flex-1 items-center justify-center chat-bg md:flex">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Send className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-semibold">Selecione uma conversa</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas conversas do WhatsApp aparecerão aqui em tempo real.
          </p>
        </div>
      </section>
    );
  }

  async function handleSend() {
    const content = draft.trim();
    if (!content || sending || !conversation) return;
    setSending(true);
    setError(null);
    try {
      await api.sendMessage(conversation.id, content);
      setDraft("");
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  }

  async function handleAssign() {
    if (assigning || !conversation) return;
    setAssigning(true);
    setError(null);
    try {
      await api.assignConversation(conversation.id);
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao assumir");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <section key={conversation.id} className="flex h-full min-h-0 w-full flex-col chat-bg animate-in fade-in duration-150">
      {/* HEADER (fixo no topo) */}
      <header className="z-10 flex shrink-0 items-center gap-3 border-b border-border bg-card/80 px-3 py-3 backdrop-blur md:px-5 md:py-3.5">
        {onBack && (
          <button
            onClick={onBack}
            className="-ml-1 rounded-full p-2 text-muted-foreground transition hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <Avatar name={conversation.name} isGroup={isGroup} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-base font-semibold leading-tight">{conversation.name}</h2>
            <span className="hidden shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:inline">
              {isGroup ? "Grupo" : "Privado"}
            </span>
            <StatusBadge status={conversation.status} className="hidden shrink-0 sm:inline-flex" />
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {conversation.assignedTo ? `Atribuída a ${conversation.assignedTo.name}` : "Não atribuída"}
          </p>
        </div>
        <button
          onClick={handleAssign}
          disabled={assigning}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-primary/20 disabled:opacity-60"
        >
          {assigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          <span className="hidden xs:inline sm:inline">Assumir</span>
        </button>
      </header>

      {/* MENSAGENS (área scrollável) */}
      <div
        ref={scrollRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 md:px-6 md:py-5"
      >
        {loadingMessages && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mensagens...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nenhuma mensagem ainda. Envie a primeira!
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {grouped.map(({ m, showSender }, idx) => {
              const prev = grouped[idx - 1]?.m;
              const gapTop = prev && prev.fromMe !== m.fromMe ? "mt-2" : "";
              return (
                <div key={m.id} className={gapTop}>
                  <MessageBubble message={m} showSender={showSender} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INPUT (fixo no rodapé) */}
      <div
        className="shrink-0 border-t border-border bg-card/80 px-3 py-3 backdrop-blur md:px-5"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {error && <p className="mb-2 text-xs text-destructive">{error}</p>}
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={1}
            placeholder="Digite uma mensagem..."
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-3xl border border-border bg-input/70 px-4 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim()}
            aria-label="Enviar"
            className={cn(
              "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition sm:h-11 sm:w-auto sm:gap-2 sm:px-5",
              "hover:bg-primary-glow disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline text-sm font-semibold">Enviar</span>
          </button>
        </div>
      </div>
    </section>
  );
}
