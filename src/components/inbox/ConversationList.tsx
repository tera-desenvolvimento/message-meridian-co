import { useEffect, useMemo, useState } from "react";
import { Search, Inbox, Filter, Plus, Loader2, Flag, User, Check, Users, UserRound, MessageSquare } from "lucide-react";
import type { Conversation, ConversationStatus, ConversationType, TeamMember } from "@/lib/types";
import { formatRelative, formatWhatsappId } from "@/lib/format";
import { StatusBadge, TypeTag } from "./StatusBadge";
import { ContactAvatar } from "./ContactAvatar";
import { WaitingTimer } from "./WaitingTimer";
import { cn } from "@/lib/utils";
import { api } from "@/lib/http";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  conversations: Conversation[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onConversationCreated?: (id: string) => void;
}

const FILTERS: { id: "ALL" | ConversationStatus; label: string }[] = [
  { id: "ALL", label: "Todas" },
  { id: "OPEN", label: "Abertas" },
  { id: "PENDING", label: "Aguardando atendimento" },
  { id: "CLOSED", label: "Fechadas" },
];

const priorityBar: Record<"LOW" | "NORMAL" | "HIGH" | "URGENT", string> = {
  LOW: "bg-border-strong",
  NORMAL: "bg-info",
  HIGH: "bg-warning",
  URGENT: "bg-destructive",
};

const priorityFlag: Record<
  "LOW" | "NORMAL" | "HIGH" | "URGENT",
  { label: string; className: string } | null
> = {
  LOW: null,
  NORMAL: null,
  HIGH: {
    label: "Alta",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  URGENT: {
    label: "Urgente",
    className: "border-destructive/40 bg-destructive/10 text-destructive",
  },
};

export function ConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  onConversationCreated,
}: Props) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | ConversationStatus>("ALL");
  const [tab, setTab] = useState<"ALL" | ConversationType>("ALL");
  // "ALL" = todos, "ME" = atribuídas a mim, "UNASSIGNED" = sem agente,
  // ou um userId específico de outro agente.
  const [agentFilter, setAgentFilter] = useState<string>("ALL");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [newOpen, setNewOpen] = useState(false);

  // Carrega membros do workspace uma vez para alimentar o filtro/dropdown.
  useEffect(() => {
    let mounted = true;
    api
      .listUsers()
      .then((list) => {
        if (mounted) setMembers(list.filter((m) => m.active));
      })
      .catch((e) => console.error("Failed to load members for filter", e));
    return () => {
      mounted = false;
    };
  }, []);

  // Conversas filtradas pela aba (tipo) — usadas para a lista e para os
  // contadores de status/agente, para que os números reflitam a aba ativa.
  const tabScoped = useMemo(() => {
    if (tab === "ALL") return conversations;
    return conversations.filter((c) => c.type === tab);
  }, [conversations, tab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tabScoped.filter((c) => {
      if (filter !== "ALL" && c.status !== filter) return false;
      if (agentFilter === "ME") {
        if (c.assignedTo?.id !== user?.id) return false;
      } else if (agentFilter === "UNASSIGNED") {
        if (c.assignedTo) return false;
      } else if (agentFilter !== "ALL") {
        if (c.assignedTo?.id !== agentFilter) return false;
      }
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q);
    });
  }, [tabScoped, query, filter, agentFilter, user?.id]);

  const tabCounts = useMemo(() => {
    return {
      ALL: conversations.length,
      PRIVATE: conversations.filter((c) => c.type === "PRIVATE").length,
      GROUP: conversations.filter((c) => c.type === "GROUP").length,
    };
  }, [conversations]);

  const counts = useMemo(() => {
    return {
      ALL: tabScoped.length,
      OPEN: tabScoped.filter((c) => c.status === "OPEN").length,
      PENDING: tabScoped.filter((c) => c.status === "PENDING").length,
      CLOSED: tabScoped.filter((c) => c.status === "CLOSED").length,
    };
  }, [tabScoped]);

  const agentCounts = useMemo(() => {
    const byAgent: Record<string, number> = {};
    let unassigned = 0;
    let mine = 0;
    for (const c of tabScoped) {
      if (!c.assignedTo) {
        unassigned++;
      } else {
        byAgent[c.assignedTo.id] = (byAgent[c.assignedTo.id] ?? 0) + 1;
        if (c.assignedTo.id === user?.id) mine++;
      }
    }
    return { byAgent, unassigned, mine };
  }, [tabScoped, user?.id]);

  const agentFilterLabel = useMemo(() => {
    if (agentFilter === "ALL") return "Todos os agentes";
    if (agentFilter === "ME") return "Atribuídas a mim";
    if (agentFilter === "UNASSIGNED") return "Sem agente";
    const m = members.find((x) => x.id === agentFilter);
    return m ? m.name : "Agente";
  }, [agentFilter, members]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-surface md:w-[340px] md:border-r md:border-border lg:w-[400px]">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-3 pb-3 pt-3 sm:px-4 sm:pt-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Inbox className="h-4 w-4" />
          </div>
          <h1 className="text-sm font-semibold tracking-tight">Caixa de entrada</h1>
          <span className="ml-auto rounded border border-border-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {counts.ALL}
          </span>
          <button
            type="button"
            onClick={() => setNewOpen(true)}
            title="Nova conversa"
            aria-label="Nova conversa"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-muted-foreground transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Type tabs (Todas / Contatos / Grupos) */}
        <div className="mb-3 flex items-center gap-1 rounded-md border border-border bg-surface-2/40 p-0.5">
          {([
            { id: "ALL", label: "Todas", icon: MessageSquare },
            { id: "PRIVATE", label: "Contatos", icon: UserRound },
            { id: "GROUP", label: "Grupos", icon: Users },
          ] as const).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[11px] font-medium transition",
                  active
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{t.label}</span>
                <span className="font-mono text-[10px] opacity-60">
                  {tabCounts[t.id]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar tickets, contatos…"
            className="w-full rounded-md border border-border bg-input/60 py-1.5 pl-8 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Filter tabs — encurta rótulos longos em mobile e permite quebra */}
        <div className="mt-3 flex flex-wrap items-center gap-1">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {FILTERS.map((f) => {
            const shortLabel =
              f.id === "PENDING" ? "Aguardando" : f.label;
            return (
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
                {shortLabel}
                <span className="ml-1 font-mono text-[10px] opacity-60">
                  {counts[f.id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Agent filter */}
        <div className="mt-2 flex items-center gap-1">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex flex-1 items-center justify-between rounded border border-border bg-surface-2/60 px-2 py-1 text-[11px] font-medium text-foreground/80 transition hover:border-border-strong"
              >
                <span className="truncate">{agentFilterLabel}</span>
                <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                  {filtered.length}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filtrar por agente</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <AgentFilterItem
                label="Todos os agentes"
                count={conversations.length}
                active={agentFilter === "ALL"}
                onSelect={() => setAgentFilter("ALL")}
              />
              <AgentFilterItem
                label="Atribuídas a mim"
                count={agentCounts.mine}
                active={agentFilter === "ME"}
                onSelect={() => setAgentFilter("ME")}
              />
              <AgentFilterItem
                label="Sem agente"
                count={agentCounts.unassigned}
                active={agentFilter === "UNASSIGNED"}
                onSelect={() => setAgentFilter("UNASSIGNED")}
              />
              {members.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Equipe
                  </DropdownMenuLabel>
                  {members.map((m) => (
                    <AgentFilterItem
                      key={m.id}
                      label={m.id === user?.id ? `${m.name} (você)` : m.name}
                      count={agentCounts.byAgent[m.id] ?? 0}
                      active={agentFilter === m.id}
                      onSelect={() => setAgentFilter(m.id)}
                    />
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* List */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <ListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-muted-foreground">
            Nenhum ticket corresponde aos filtros.
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
                      "group relative flex w-full items-start gap-2.5 border-b border-border px-3 py-2.5 text-left transition sm:gap-3 sm:px-4 sm:py-3",
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

                    <ContactAvatar
                      src={c.avatarUrl}
                      name={c.name}
                      isGroup={c.type === "GROUP"}
                      size="md"
                      className="mt-0.5"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
                            {formatWhatsappId(c.externalId) || `#${c.id.slice(0, 8).toUpperCase()}`}
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
                        {priorityFlag[prio] && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                              priorityFlag[prio]!.className,
                            )}
                          >
                            <Flag className="h-2.5 w-2.5" />
                            {priorityFlag[prio]!.label}
                          </span>
                        )}
                        {c.awaitingReplySince && c.status !== "CLOSED" && (
                          <WaitingTimer since={c.awaitingReplySince} />
                        )}
                        <span className="ml-auto min-w-0 truncate text-[11px] text-muted-foreground">
                          {c.assignedTo ? (
                            <>
                              <span className="text-muted-foreground/70">→ </span>
                              <span className="font-medium text-foreground/80">
                                {c.assignedTo.name}
                              </span>
                            </>
                          ) : (
                            <span className="italic text-muted-foreground/70">Sem agente</span>
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

      <NewConversationDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(id) => {
          onConversationCreated?.(id);
          onSelect(id);
        }}
      />
    </aside>
  );
}

function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPhone("");
    setName("");
    setSubmitting(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 8) {
      toast.error("Informe um número de WhatsApp válido (com DDI/DDD).");
      return;
    }
    if (!name.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api.startConversation(digits, name.trim());
      toast.success(result.created ? "Conversa criada" : "Conversa já existia — abrindo");
      onCreated(result.id);
      onOpenChange(false);
      reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao iniciar conversa";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova conversa</DialogTitle>
          <DialogDescription>
            Inicie uma conversa enviando o primeiro contato pelo WhatsApp do workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-phone">Número do WhatsApp</Label>
            <Input
              id="new-conv-phone"
              type="tel"
              autoComplete="off"
              placeholder="Ex.: +55 11 91234-5678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={submitting}
            />
            <p className="text-[11px] text-muted-foreground">
              Inclua o código do país (DDI) e o DDD. Caracteres não numéricos são removidos.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-conv-name">Nome do contato</Label>
            <Input
              id="new-conv-name"
              placeholder="Como esse contato deve aparecer na inbox"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Criando…
                </>
              ) : (
                "Criar conversa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

function AgentFilterItem({
  label,
  count,
  active,
  onSelect,
}: {
  label: string;
  count: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="flex items-center gap-2">
      <span className="flex-1 truncate">{label}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
      {active && <Check className="h-3.5 w-3.5 text-primary" />}
    </DropdownMenuItem>
  );
}
