import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, BotOff, CheckCircle2, Clock, Inbox, UserCheck, Users } from "lucide-react";
import { api } from "@/lib/http";
import type { Conversation } from "@/lib/types";
import { filterConversationsByRole } from "@/lib/permissions";
import { usePolling } from "@/hooks/usePolling";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Dohkochat" },
      { name: "description", content: "Visão geral dos atendimentos do workspace." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-row bg-background text-foreground">
        <AppHeader />
        <div className="flex min-h-0 flex-1 overflow-auto">
          <DashboardContent />
        </div>
      </div>
    </AuthGuard>
  );
}

type Bucket = {
  key: string;
  label: string;
  description: string;
  icon: typeof Inbox;
  tone: string;
  filter: (c: Conversation) => boolean;
};

function DashboardContent() {
  const { user, isAuthenticated } = useAuth();
  const ready = isAuthenticated && !!user?.workspaceId;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState<string>("open");

  const refresh = async () => {
    if (!ready) return;
    try {
      const list = await api.listConversations();
      setConversations(list);
    } catch (e) {
      console.error("Failed to load conversations", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  usePolling(refresh, 10000, ready);

  const visible = useMemo(
    () => filterConversationsByRole(conversations, user),
    [conversations, user],
  );

  const buckets: Bucket[] = useMemo(
    () => [
      {
        key: "open",
        label: "Em aberto",
        description: "Conversas ativas no momento",
        icon: Inbox,
        tone: "text-blue-500",
        filter: (c) => c.status === "OPEN",
      },
      {
        key: "in_progress",
        label: "Em atendimento",
        description: "Conversas atribuídas a um agente",
        icon: UserCheck,
        tone: "text-emerald-500",
        filter: (c) => c.status === "OPEN" && !!c.assignedTo,
      },
      {
        key: "waiting",
        label: "Aguardando",
        description: "Cliente esperando resposta da equipe",
        icon: Clock,
        tone: "text-amber-500",
        filter: (c) => c.status === "OPEN" && !!c.awaitingReplySince,
      },
      {
        key: "bot",
        label: "Com bot ativo",
        description: "Sendo atendidas pelo bot",
        icon: Bot,
        tone: "text-violet-500",
        filter: (c) => c.botActive && c.status === "OPEN",
      },
      {
        key: "bot_abandoned",
        label: "Abandonou o bot",
        description: "Bot desativado e sem agente atribuído",
        icon: BotOff,
        tone: "text-rose-500",
        filter: (c) => !c.botActive && !c.assignedTo && c.status === "OPEN",
      },
      {
        key: "unassigned",
        label: "Sem responsável",
        description: "Em aberto e sem agente",
        icon: Users,
        tone: "text-orange-500",
        filter: (c) => c.status === "OPEN" && !c.assignedTo,
      },
      {
        key: "pending",
        label: "Pendentes",
        description: "Marcadas como pendentes",
        icon: Activity,
        tone: "text-yellow-500",
        filter: (c) => c.status === "PENDING",
      },
      {
        key: "closed",
        label: "Encerradas",
        description: "Conversas finalizadas",
        icon: CheckCircle2,
        tone: "text-muted-foreground",
        filter: (c) => c.status === "CLOSED",
      },
    ],
    [],
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const b of buckets) m[b.key] = visible.filter(b.filter).length;
    return m;
  }, [buckets, visible]);

  const current = buckets.find((b) => b.key === activeBucket) ?? buckets[0];
  const filtered = visible.filter(current.filter);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Visão geral dos atendimentos {loading && "(carregando...)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {buckets.map((b) => {
          const Icon = b.icon;
          const active = b.key === activeBucket;
          return (
            <button
              key={b.key}
              onClick={() => setActiveBucket(b.key)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition",
                active
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:bg-accent/50",
              )}
            >
              <div className="flex w-full items-center justify-between">
                <Icon className={cn("h-5 w-5", b.tone)} />
                <span className="text-2xl font-bold tabular-nums">{counts[b.key]}</span>
              </div>
              <div>
                <div className="text-sm font-medium">{b.label}</div>
                <div className="text-xs text-muted-foreground">{b.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">{current.label}</h2>
          <p className="text-xs text-muted-foreground">{filtered.length} conversa(s)</p>
        </div>
        <div className="divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Nenhuma conversa nesta categoria.
            </div>
          ) : (
            filtered.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
                  {c.avatarUrl ? (
                    <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    c.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    {c.botActive && (
                      <span className="rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium text-violet-500">
                        BOT
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{c.lastMessage}</div>
                </div>
                <div className="hidden text-right sm:block">
                  <div className="text-xs text-muted-foreground">
                    {c.assignedTo?.name ?? "Sem responsável"}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
