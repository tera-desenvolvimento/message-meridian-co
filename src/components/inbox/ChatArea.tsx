import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Flag,
  Loader2,
  MoreHorizontal,
  Send,
  UserPlus,
  Users,
  User,
} from "lucide-react";
import type { Conversation, Message } from "@/lib/types";
import { api } from "@/lib/http";
import { StatusBadge, TypeTag } from "./StatusBadge";
import { MessageBlock } from "./MessageBlock";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  loadingMessages: boolean;
  onSent: () => void;
  onAssigned: () => void;
  onBack?: () => void;
}

export function ChatArea({
  conversation,
  messages,
  loadingMessages,
  onSent,
  onAssigned,
  onBack,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, conversation?.id]);

  useEffect(() => {
    setDraft("");
    setError(null);
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <section className="hidden h-full min-h-0 flex-1 items-center justify-center bg-background md:flex">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface text-muted-foreground">
            <Send className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-semibold tracking-tight">No ticket selected</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Pick a conversation from the inbox to start working.
          </p>
        </div>
      </section>
    );
  }

  const isGroup = conversation.type === "GROUP";

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
      setError(e instanceof Error ? e.message : "Failed to send");
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
      setError(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* HEADER — panel-style */}
      <header className="z-10 shrink-0 border-b border-border bg-surface">
        <div className="flex items-center gap-3 px-4 py-3 md:px-6">
          {onBack && (
            <button
              onClick={onBack}
              className="-ml-1 rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground md:hidden"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
            {isGroup ? <Users className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">
                #{conversation.id.toUpperCase()}
              </span>
              <h2 className="truncate text-[14px] font-semibold tracking-tight">
                {conversation.name}
              </h2>
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>
                {conversation.assignedTo ? (
                  <>
                    Assigned to{" "}
                    <span className="font-medium text-foreground/80">
                      {conversation.assignedTo.name}
                    </span>
                  </>
                ) : (
                  <span className="italic">Unassigned</span>
                )}
              </span>
              <span className="text-border-strong">•</span>
              <span>{messages.length} messages</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <ToolbarButton icon={<Flag className="h-3.5 w-3.5" />} label="Priority" />
            <ToolbarButton icon={<ChevronDown className="h-3.5 w-3.5" />} label="Status" />
            <ToolbarButton
              icon={
                assigning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UserPlus className="h-3.5 w-3.5" />
                )
              }
              label="Assign"
              onClick={handleAssign}
              disabled={assigning}
              variant="primary"
            />
            <button
              className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground"
              aria-label="More"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-header: properties strip */}
        <div className="flex items-center gap-2 border-t border-border bg-surface px-4 py-2 md:px-6">
          <PropPill label="Status">
            <StatusBadge status={conversation.status} />
          </PropPill>
          <PropPill label="Type">
            <TypeTag type={conversation.type} />
          </PropPill>
          <PropPill label="Channel">
            <span className="text-[11px] font-medium text-foreground/80">WhatsApp</span>
          </PropPill>
        </div>
      </header>

      {/* MESSAGES — single column blocks */}
      <div
        ref={scrollRef}
        className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-background px-4 py-5 md:px-8 md:py-6"
      >
        {loadingMessages && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading thread…
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
            No messages yet.
          </div>
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
            {messages.map((m) => (
              <MessageBlock key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      {/* COMPOSER */}
      <div
        className="shrink-0 border-t border-border bg-surface px-4 py-3 md:px-6"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-3xl">
          {error && <p className="mb-2 text-[12px] text-destructive">{error}</p>}
          <div className="rounded-md border border-border bg-input/40 transition focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={2}
              placeholder="Reply as agent…  (Enter to send, Shift+Enter for newline)"
              className="block max-h-40 min-h-[60px] w-full resize-none bg-transparent px-3 py-2.5 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="flex items-center justify-between border-t border-border px-2 py-1.5">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono">
                  Reply
                </span>
                <span className="hidden sm:inline">via WhatsApp</span>
              </div>
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition",
                  "hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {sending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-60 sm:inline-flex",
        variant === "primary"
          ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
          : "border-border bg-surface text-foreground/80 hover:border-border-strong hover:bg-surface-2",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function PropPill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}
