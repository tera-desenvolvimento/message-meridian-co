import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bot, Plus, Play, Pause, Trash2, Edit2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { AppHeader } from "@/components/layout/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { BotEditor } from "@/components/chatbot/BotEditor";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  if (editingFlowId) {
    return <BotEditor flowId={editingFlowId} onClose={() => setEditingFlowId(null)} />;
  }

  return (
    <AuthGuard>
      <div className="flex h-dvh flex-row bg-background text-foreground">
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
              <CreateFlowButton onCreated={() => window.location.reload()} />
            </header>

            <BotFlowList onEdit={(id) => setEditingFlowId(id)} />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}

function BotFlowList({ onEdit }: { onEdit: (id: string) => void }) {
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
    if (currentStatus) {
      // Pausing an active flow is simple
      const { error } = await supabase
        .from("bot_flows")
        .update({ is_active: false })
        .eq("id", id);
      
      if (error) {
        toast.error("Erro ao pausar fluxo.");
      } else {
        toast.success("Fluxo pausado");
        loadFlows();
      }
      return;
    }

    // Activating a flow:
    // 1. Pause all other flows
    // 2. Set this one as active
    // 3. Clear bot state for all active conversations (overflow to human)
    setLoading(true);
    try {
      // Step 1 & 2: Update database statuses in parallel
      const updateAllPromise = supabase
        .from("bot_flows")
        .update({ is_active: false })
        .eq("workspace_id", workspace!.id);
      
      const updateSelfPromise = supabase
        .from("bot_flows")
        .update({ is_active: true })
        .eq("id", id);

      await Promise.all([updateAllPromise, updateSelfPromise]);

      // Step 3: Handle Overflow (Interromper fluxos ativos)
      // Definimos bot_active: false e status: PENDING para todos que estavam no bot
      const { error: overflowError } = await supabase
        .from("conversations")
        .update({ bot_active: false, status: "PENDING", assigned_to: null })
        .eq("workspace_id", workspace!.id)
        .eq("bot_active", true);

      if (overflowError) console.error("Erro ao transbordar usuários:", overflowError);
      
      toast.success("Novo fluxo ativado e usuários transbordados para atendimento humano.");
      loadFlows();
    } catch (err) {
      toast.error("Erro ao trocar fluxo ativo.");
    } finally {
      setLoading(false);
    }
  }

  async function deleteFlow(id: string) {
    const { error } = await supabase
      .from("bot_flows")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Erro ao excluir fluxo. Verifique se ele não está sendo usado.");
    } else {
      toast.success("Fluxo excluído com sucesso.");
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
        <CreateFlowButton onCreated={() => window.location.reload()} variant="outline" />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {flows.map((flow) => (
        <BotFlowCard 
          key={flow.id} 
          flow={flow} 
          onEdit={() => onEdit(flow.id)} 
          onToggle={() => toggleFlow(flow.id, flow.is_active)}
          onDelete={() => deleteFlow(flow.id)}
        />
      ))}
    </div>
  );
}

function BotFlowCard({ flow, onEdit, onToggle, onDelete }: { flow: any, onEdit: () => void, onToggle: () => void, onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className="group relative flex flex-col rounded-lg border border-border bg-surface p-5 transition hover:border-primary/50"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className={`rounded-md p-2 ${flow.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
          <Bot className="h-5 w-5" />
        </div>
        <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
            <Edit2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
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
          onClick={onToggle}
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

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fluxo de chatbot?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o fluxo "{flow.name}" e todas as suas configurações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreateFlowButton({ onCreated, variant = "default" }: { onCreated: () => void, variant?: "default" | "outline" }) {
  const { workspace } = useAuth();
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("Novo Fluxo de Chatbot");
  const [description, setDescription] = useState("");

  const createFlow = async () => {
    if (!workspace?.id) return;
    if (!name.trim()) {
      toast.error("Por favor, dê um nome ao fluxo.");
      return;
    }

    setLoading(true);

    const defaultDefinition = {
      blocks: [
        {
          id: "start",
          name: "Início",
          type: "message",
          content: "Olá! Seja bem-vindo. Como podemos ajudar hoje?",
          next: null
        }
      ],
      start_block: "start"
    };

    const { error } = await supabase
      .from("bot_flows")
      .insert({
        workspace_id: workspace.id,
        name: name.trim(),
        description: description.trim(),
        definition: defaultDefinition,
        is_active: true
      });

    if (error) {
      toast.error("Erro ao criar fluxo: " + error.message);
    } else {
      toast.success("Fluxo criado com sucesso!");
      setOpen(false);
      onCreated();
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant={variant}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {variant === "outline" ? "Novo fluxo" : "Criar fluxo"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Fluxo</DialogTitle>
          <DialogDescription>
            Defina um nome e uma descrição para identificar este fluxo de automação.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Nome do Fluxo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Boas-vindas, Suporte Técnico..."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição (Opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Para que serve este fluxo?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={createFlow} disabled={loading} className="w-full">
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Criando...
              </span>
            ) : (
              "Criar Fluxo"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
