import { useMemo, useState } from "react";
import { Search, UserCheck } from "lucide-react";
import type { Conversation } from "@/lib/types";
import { formatRelative } from "@/lib/format";
import { Avatar } from "./Avatar";
import { StatusBadge } from "./StatusBadge";
import { cn } from "@/lib/utils";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, loading, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) => c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q),
    );
  }, [conversations, query]);

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-card md:w-[340px] lg:w-[380px]">
      <div className="border-b border-border p-4">
        <h1 className="mb-3 text-lg font-semibold tracking-tight">Caixa de entrada</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou telefone"
            className="w-full rounded-lg border border-border bg-input/60 py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Nenhuma conversa encontrada.</div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-accent/50",
                    selectedId === c.id && "bg-accent",
                  )}
                >
                  <Avatar name={c.name} isGroup={c.type === "GROUP"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-medium text-foreground">{c.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatRelative(c.lastMessageAt)}
                      </span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{c.lastMessage}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {c.type === "GROUP" ? "Grupo" : "Privado"}
                      </span>
                      <StatusBadge status={c.status} />
                      {c.assignedTo && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          <UserCheck className="h-3 w-3" />
                          {c.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function ListSkeleton() {
  return (
    <ul className="divide-y divide-border">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i} className="flex items-start gap-3 px-3 py-3">
          <div className="h-11 w-11 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
          </div>
        </li>
      ))}
    </ul>
  );
}
