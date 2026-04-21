import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Flag,
  Loader2,
  MoreHorizontal,
  Send,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  User,
} from "lucide-react";
import type {
  Conversation,
  ConversationPriority,
  ConversationStatus,
  Message,
  TeamMember,
} from "@/lib/types";
import { api } from "@/lib/http";
import { formatWhatsappId } from "@/lib/format";
import { StatusBadge, TypeTag } from "./StatusBadge";
import { MessageBlock } from "./MessageBlock";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  loadingMessages: boolean;
  onSent: () => void;
  onAssigned: () => void;
  onDeleted?: () => void;
  onBack?: () => void;
}

const STATUS_OPTIONS: { value: ConversationStatus; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending" },
  { value: "CLOSED", label: "Closed" },
];

const PRIORITY_OPTIONS: {
  value: ConversationPriority;
  label: string;
  cls: string;
}[] = [
  { value: "LOW", label: "Low", cls: "text-muted-foreground" },
  { value: "NORMAL", label: "Normal", cls: "text-info" },
  { value: "HIGH", label: "High", cls: "text-warning" },
  { value: "URGENT", label: "Urgent", cls: "text-destructive" },
];

export function ChatArea({
  conversation,
  messages,
  loadingMessages,
  onSent,
  onAssigned,
  onDeleted,
  onBack,
}: Props) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  // Load workspace members lazily on first interaction
  async function ensureMembers() {
    if (members.length > 0) return;
    try {
      const list = await api.listUsers();
      setMembers(list.filter((m) => m.active));
    } catch (e) {
      console.error("Failed to load members", e);
    }
  }

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

  async function withBusy(fn: () => Promise<unknown>) {
    if (!conversation) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      onAssigned();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!conversation) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteConversation(conversation.id);
      setConfirmDelete(false);
      onDeleted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  const currentPriority = PRIORITY_OPTIONS.find((p) => p.value === conversation.priority);

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-background">
      {/* HEADER */}
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
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {formatWhatsappId(conversation.externalId) ||
                  `#${conversation.id.slice(0, 8).toUpperCase()}`}
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
            {/* Priority */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={busy}
                  className={cn(
                    "hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 transition hover:border-border-strong hover:bg-surface-2 disabled:opacity-60 sm:inline-flex",
                  )}
                >
                  <Flag className={cn("h-3.5 w-3.5", currentPriority?.cls)} />
                  {currentPriority?.label ?? "Priority"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Set priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {PRIORITY_OPTIONS.map((p) => (
                  <DropdownMenuItem
                    key={p.value}
                    onSelect={() =>
                      withBusy(() => api.setConversationPriority(conversation.id, p.value))
                    }
                    className="flex items-center gap-2"
                  >
                    <Flag className={cn("h-3.5 w-3.5", p.cls)} />
                    <span className="flex-1">{p.label}</span>
                    {conversation.priority === p.value && <Check className="h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Status */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={busy}
                  className="hidden items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-foreground/80 transition hover:border-border-strong hover:bg-surface-2 disabled:opacity-60 sm:inline-flex"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Status
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Change status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem
                    key={s.value}
                    onSelect={() =>
                      withBusy(() => api.setConversationStatus(conversation.id, s.value))
                    }
                    className="flex items-center gap-2"
                  >
                    <StatusBadge status={s.value} />
                    <span className="ml-auto">
                      {conversation.status === s.value && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assign */}
            <DropdownMenu onOpenChange={(o) => o && void ensureMembers()}>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={busy}
                  className="hidden items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary transition hover:bg-primary/20 disabled:opacity-60 sm:inline-flex"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UserPlus className="h-3.5 w-3.5" />
                  )}
                  Assign
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => withBusy(() => api.assignConversation(conversation.id))}
                  className="flex items-center gap-2"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Assign to me
                </DropdownMenuItem>
                {conversation.assignedTo && (
                  <DropdownMenuItem
                    onSelect={() => withBusy(() => api.unassignConversation(conversation.id))}
                    className="flex items-center gap-2"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    Unassign
                  </DropdownMenuItem>
                )}
                {members.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      Team members
                    </DropdownMenuLabel>
                    {members.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onSelect={() =>
                          withBusy(() => api.assignConversation(conversation.id, m.id))
                        }
                        className="flex items-center gap-2"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate">{m.name}</span>
                        {conversation.assignedTo?.id === m.id && (
                          <Check className="h-3.5 w-3.5" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* More */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  disabled={busy}
                  className="rounded-md p-1.5 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
                  aria-label="More"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() =>
                    withBusy(() => api.setConversationStatus(conversation.id, "CLOSED"))
                  }
                  className="flex items-center gap-2"
                >
                  <Check className="h-3.5 w-3.5" />
                  Mark as closed
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    withBusy(() => api.setConversationStatus(conversation.id, "OPEN"))
                  }
                  className="flex items-center gap-2"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Reopen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete conversation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Sub-header: properties strip */}
        <div className="flex items-center gap-2 border-t border-border bg-surface px-4 py-2 md:px-6">
          <PropPill label="Status">
            <StatusBadge status={conversation.status} />
          </PropPill>
          <PropPill label="Priority">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-medium",
                currentPriority?.cls,
              )}
            >
              <Flag className="h-3 w-3" />
              {currentPriority?.label}
            </span>
          </PropPill>
          <PropPill label="Type">
            <TypeTag type={conversation.type} />
          </PropPill>
          <PropPill label="Channel">
            <span className="text-[11px] font-medium text-foreground/80">WhatsApp</span>
          </PropPill>
        </div>
      </header>

      {/* MESSAGES */}
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the conversation and all its messages. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
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
