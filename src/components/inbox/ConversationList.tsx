import { useMemo, useState } from "react";
import { Search, User, Users, Inbox, Filter } from "lucide-react";
import type { Conversation, ConversationStatus } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { StatusBadge, TypeTag } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const FILTERS: { id: "ALL" | ConversationStatus; label: string }[] = [
  { id: "ALL", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "PENDING", label: "Pending" },
  { id: "CLOSED", label: "Closed" },
];

const priorityBar: Record<"LOW" | "NORMAL" | "HIGH" | "URGENT", string> = {
  LOW: "bg-border-strong",
  NORMAL: "bg-info",
  HIGH: "bg-warning",
  URGENT: "bg-destructive",
};

export function ConversationList({ conversations, loading, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | ConversationStatus>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter !== "ALL" && c.status !== filter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
    });
  }, [conversations, query, filter]);

  const counts = useMemo(() => {
    return {
      ALL: conversations.length,
      OPEN: conversations.filter((c) => c.status === "OPEN").length,
      PENDING: conversations.filter((c) => c.status === "PENDING").length,
      CLOSED: conversations.filter((c) => c.status === "CLOSED").length,
    };
  }, [conversations]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-surface md:w-[360px] md:border-r md:border-border lg:w-[400px]">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Inbox className="h-4 w-4" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">Inbox</h1>
          <span className="ml-auto rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {counts.ALL} tickets
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tickets, contacts…"
            className="w-full rounded-md border border-border bg-input/60 py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter tabs */}
        <div className="mt-3 flex items-center gap-1">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded px-2 py-1 text-[11px] font-medium uppercase tracking-wider transition",
                filter === f.id
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:bg-surface-2/60 hover:text-foreground",
              )}
            >
              {f.label}
              <span className="ml-1 font-mono text-[10px] opacity-60">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            No tickets match your filters.
          </div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const prio = c.priority;
              const active = selectedId === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={cn(
                      "group relative flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left transition",
                      active ? "bg-surface-2" : "hover:bg-surface-2/60",
                    )}
                  >
                    {/* Active indicator + priority bar */}
                    <span
                      className={cn(
                        "absolute left-0 top-2 bottom-2 w-0.5 rounded-r",
                        active ? "bg-primary" : priorityBar[prio],
                      )}
                    />

                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground">
                      {c.type === "GROUP" ? <Users className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            #{c.id.toUpperCase()}
                          </span>
                          <span className="truncate text-[13px] font-semibold text-foreground">
                            {c.name}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {formatRelative(c.lastMessageAt)}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                        {c.lastMessage}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={c.status} />
                        <TypeTag type={c.type} />
                        <span className="ml-auto truncate text-[11px] text-muted-foreground">
                          {c.assignedTo ? (
                            <>
                              <span className="text-muted-foreground/70">→ </span>
                              <span className="font-medium text-foreground/80">
                                {c.assignedTo.name}
                              </span>
                            </>
                          ) : (
                            <span className="italic text-muted-foreground/70">Unassigned</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ListSkeleton() {
  return (
    <ul>
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 border-b border-border px-4 py-3">
          <div className="h-7 w-7 animate-pulse rounded-md bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
