import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Plus, Play, Pause, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/chatbot")({
  head: () => ({
    meta: [
      { title: "Chatbot — Dohkozap" },
      { name: "description", content: "Gerenciamento de fluxos de automação." },
    ],
  }),
  component: ChatbotPage,
});

function ChatbotPage() {
  return (
    <AuthGuard>
      <div className="flex h-dvh flex-col bg-background text-foreground">
        <AppHeader />
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <header className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Chatbot</h1>
                <p className="text-sm text-muted-foreground">
                  Crie e gerencie fluxos de atendimento automatizado estilo Blip.
                </p>
              </div>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Criar fluxo
              </Button>
            </header>

            <BotFlowList />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function BotFlowList() {
  const { workspace } = useAuth();
  const [flows, setFlows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workspace?.id) return;
    loadFlows();
  }, [workspace?.id]);

  async function loadFlows() {
    if (!workspace?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("bot_flows")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar fluxos.");
    } else {
      setFlows(data ?? []);
    }
    setLoading(false);
  }

  async function toggleFlow(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from("bot_flows")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao atualizar status.");
    } else {
      toast.success(currentStatus ? "Fluxo pausado" : "Fluxo ativado");
      loadFlows();
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">Carregando fluxos...</p>
      </div>
    );
  }

  if (flows.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
          <Bot className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold">Nenhum fluxo encontrado</h3>
        <p className="mb-6 text-sm text-muted-foreground">
          Comece criando um fluxo de boas-vindas ou menu inicial para seus clientes.
        </p>
        <Button variant="outline" className="gap-2">
          <Plus className="h-4 w-4" />
          Novo fluxo
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {flows.map((flow) => (
        <div
          key={flow.id}
          className="group relative flex flex-col rounded-lg border border-border bg-surface p-5 transition hover:border-primary/50"
        >
          <div className="mb-3 flex items-start justify-between">
            <div className={`rounded-md p-2 ${flow.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <h3 className="font-semibold">{flow.name}</h3>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {flow.description || "Sem descrição definida."}
          </p>

          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${flow.is_active ? 'text-success' : 'text-muted-foreground'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${flow.is_active ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
              {flow.is_active ? "Ativo" : "Pausado"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-[11px]"
              onClick={() => toggleFlow(flow.id, flow.is_active)}
            >
              {flow.is_active ? (
                <>
                  <Pause className="h-3 w-3" /> Pausar
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" /> Ativar
                </>
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
