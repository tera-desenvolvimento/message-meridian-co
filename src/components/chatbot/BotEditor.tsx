import React, { useState, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  NodeProps,
  Edge,
  Node,
  OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Bot, MessageSquare, ListTree, UserPlus, Save, X, Plus, Trash2, Sparkles, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// --- Custom Nodes ---

const BaseNode = ({ title, icon: Icon, children, selected, onEdit }: any) => (
  <div className={`min-w-[200px] rounded-lg border bg-background shadow-md transition-all ${selected ? 'border-primary ring-2 ring-primary/20' : 'border-border'}`}>
    <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-2">
      <div className="rounded bg-primary/10 p-1 text-primary">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      {onEdit && <button onClick={onEdit} className="ml-auto text-[10px] text-muted-foreground hover:text-primary">Editar</button>}
    </div>
    <div className="p-3">
      {children}
    </div>
  </div>
);

const MessageNode = ({ data, selected }: NodeProps) => (
  <BaseNode title="Mensagem" icon={MessageSquare} selected={selected}>
    <Handle type="target" position={Position.Top} className="!bg-primary" />
    <p className="line-clamp-3 text-xs text-muted-foreground">{data.content as string || 'Sem mensagem configurada'}</p>
    <Handle type="source" position={Position.Bottom} className="!bg-primary" />
  </BaseNode>
);

const ChoiceNode = ({ data, selected }: NodeProps) => (
  <BaseNode title="Decisão" icon={ListTree} selected={selected}>
    <Handle type="target" position={Position.Top} className="!bg-primary" />
    <p className="mb-2 line-clamp-2 text-[10px] text-muted-foreground font-medium">{data.content as string}</p>
    <div className="space-y-1">
      {(data.options as any[])?.map((opt, i) => (
        <div key={i} className="relative flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-[10px]">
          <span>{opt.label}</span>
          <Handle
            type="source"
            position={Position.Right}
            id={`opt-${i}`}
            style={{ top: '50%', right: '-8px' }}
            className="!bg-primary"
          />
        </div>
      ))}
      <div className="relative mt-2 flex items-center justify-between rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-600">
        <span>Esgotou tentativas</span>
        <Handle
          type="source"
          position={Position.Right}
          id="exhaust"
          style={{ top: '50%', right: '-8px' }}
          className="!bg-amber-500"
        />
      </div>
    </div>
  </BaseNode>
);

const TransferNode = ({ data, selected }: NodeProps) => (
  <BaseNode title="Transbordo" icon={UserPlus} selected={selected}>
    <Handle type="target" position={Position.Top} className="!bg-primary" />
    <div className="flex items-center gap-2 rounded bg-success/10 px-2 py-1 text-[10px] text-success">
      <Bot className="h-3 w-3" />
      <span>Atendimento Humano</span>
    </div>
  </BaseNode>
);

const AiNode = ({ data, selected }: NodeProps) => (
  <BaseNode title="IA" icon={Sparkles} selected={selected}>
    <Handle type="target" position={Position.Top} className="!bg-primary" />
    <p className="line-clamp-3 text-xs text-muted-foreground">
      {(data.system_prompt as string) || (data.content as string) || 'Configure o prompt do sistema'}
    </p>
    <Handle type="source" position={Position.Bottom} className="!bg-primary" />
  </BaseNode>
);

const TimeoutNode = ({ data, selected }: NodeProps) => (
  <BaseNode title="Tempo de espera" icon={Clock} selected={selected}>
    <Handle type="target" position={Position.Top} className="!bg-primary" />
    <p className="line-clamp-2 text-xs text-muted-foreground">
      Aguardar <strong>{(data.wait_seconds as number) ?? 120}s</strong> · até{' '}
      <strong>{(data.max_retries as number) ?? 2}</strong> cutucada(s)
    </p>
    <div className="mt-2 space-y-1">
      <div className="relative flex items-center justify-between rounded bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-600">
        <span>Respondeu</span>
        <Handle
          type="source"
          position={Position.Right}
          id="reply"
          style={{ top: '50%', right: '-8px' }}
          className="!bg-emerald-500"
        />
      </div>
      <div className="relative flex items-center justify-between rounded bg-rose-500/10 px-2 py-1 text-[10px] text-rose-600">
        <span>Esgotou</span>
        <Handle
          type="source"
          position={Position.Right}
          id="exhaust"
          style={{ top: '50%', right: '-8px' }}
          className="!bg-rose-500"
        />
      </div>
    </div>
  </BaseNode>
);

const nodeTypes = {
  message: MessageNode,
  choice: ChoiceNode,
  transfer: TransferNode,
  ai: AiNode,
  timeout: TimeoutNode,
};

// --- Editor Component ---

interface BotEditorProps {
  flowId: string;
  onClose: () => void;
}

export function BotEditor({ flowId, onClose }: BotEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    async function loadFlow() {
      setLoading(true);
      const { data, error } = await supabase
        .from('bot_flows')
        .select('definition')
        .eq('id', flowId)
        .single();

      if (error) {
        toast.error('Erro ao carregar o fluxo.');
        onClose();
        return;
      }

      const def = data.definition as any;
      if (def && def.nodes && def.edges) {
        setNodes(def.nodes);
        setEdges(def.edges);
      } else if (def && def.blocks) {
        const initialNodes: Node[] = def.blocks.map((b: any, i: number) => ({
          id: b.id,
          type: b.type,
          position: { x: 250, y: i * 200 },
          data: { ...b },
        }));
        setNodes(initialNodes);
      }
      setLoading(false);
    }
    loadFlow();
  }, [flowId]);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  const handleSave = async () => {
    setSaving(true);
    const definition = {
      nodes,
      edges,
      blocks: nodes.map((n) => {
        const data = n.data as any;
        const base: any = {
          id: n.id,
          type: n.type,
          ...data,
          next: edges.find((e) => e.source === n.id && !e.sourceHandle)?.target || null,
        };

        if (n.type === 'choice') {
          base.options = (data.options || []).map((opt: any, i: number) => ({
            ...opt,
            next: edges.find((e) => e.source === n.id && e.sourceHandle === `opt-${i}`)?.target || null,
          }));
          base.exhaust_next =
            edges.find((e) => e.source === n.id && e.sourceHandle === 'exhaust')?.target || null;
        }

        if (n.type === 'timeout') {
          base.next_on_reply =
            edges.find((e) => e.source === n.id && e.sourceHandle === 'reply')?.target || null;
          base.exhaust_next =
            edges.find((e) => e.source === n.id && e.sourceHandle === 'exhaust')?.target || null;
        }

        return base;
      }),
      start_block: nodes.length > 0 ? nodes[0].id : null,
    };

    const { error } = await supabase
      .from('bot_flows')
      .update({ definition: definition as any })
      .eq('id', flowId);

    if (error) {
      toast.error('Erro ao salvar o fluxo.');
    } else {
      toast.success('Fluxo salvo com sucesso!');
    }
    setSaving(false);
  };

  const addNode = (type: 'message' | 'choice' | 'transfer' | 'ai' | 'timeout') => {
    const id = `${type}-${Date.now()}`;
    const defaults: Record<string, any> = {
      message: { content: 'Olá, como posso ajudar?' },
      choice: {
        content: 'Escolha uma opção:',
        options: [{ label: 'Opção 1' }],
        max_retries: 2,
        retry_message: 'Desculpe, não entendi. Por favor, escolha uma das opções.',
        on_exhaust: 'transfer',
      },
      transfer: { content: 'Transferindo para um atendente...' },
      ai: {
        content: 'Aguarde, estou pensando...',
        system_prompt:
          'Você é um assistente de atendimento. Responda de forma clara, breve e cordial em português.',
      },
      timeout: {
        content: 'Aguardando resposta do cliente...',
        wait_seconds: 120,
        max_retries: 2,
        nudge_message: 'Você ainda está aí? Posso ajudar em mais alguma coisa?',
        on_exhaust: 'end',
        end_message: 'Encerrei o atendimento por inatividade. Se precisar, é só chamar de novo!',
        transfer_message: 'Vou te transferir para um atendente humano.',
      },
    };
    const newNode: Node = {
      id,
      type,
      position: { x: Math.random() * 400, y: Math.random() * 400 },
      data: { name: `Novo ${type}`, ...defaults[type] },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (id: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
  };

  const deleteNode = (id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (loading) return <div className="flex h-full items-center justify-center">Carregando editor...</div>;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b bg-surface px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">Construtor de Bot</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => addNode('message')} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Mensagem
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode('choice')} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Decisão
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode('timeout')} className="gap-2">
            <Clock className="h-3.5 w-3.5" /> Tempo de espera
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode('transfer')} className="gap-2">
            <Plus className="h-3.5 w-3.5" /> Transbordo
          </Button>
          <Button variant="outline" size="sm" onClick={() => addNode('ai')} className="gap-2">
            <Sparkles className="h-3.5 w-3.5" /> IA
          </Button>
          <Button onClick={handleSave} disabled={saving} className="ml-4 gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar Fluxo'}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {selectedNode && (
          <aside className="w-80 border-l bg-surface p-6 overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground">Editar Bloco</h3>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteNode(selectedNode.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Bloco</Label>
                <Input
                  value={(selectedNode.data as any).name || ''}
                  onChange={(e) => updateNodeData(selectedNode.id, { name: e.target.value })}
                />
              </div>

              {selectedNode.type !== 'transfer' && selectedNode.type !== 'timeout' && (
                <div className="space-y-2">
                  <Label>{selectedNode.type === 'ai' ? 'Mensagem de fallback' : 'Mensagem'}</Label>
                  <Textarea
                    rows={selectedNode.type === 'ai' ? 2 : 4}
                    value={(selectedNode.data as any).content || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { content: e.target.value })}
                    placeholder={
                      selectedNode.type === 'ai'
                        ? 'Texto enviado se a IA falhar...'
                        : 'Digite a mensagem que o bot enviará...'
                    }
                  />
                </div>
              )}

              {selectedNode.type === 'ai' && (
                <div className="space-y-2">
                  <Label>Prompt do sistema</Label>
                  <Textarea
                    rows={6}
                    value={(selectedNode.data as any).system_prompt || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { system_prompt: e.target.value })}
                    placeholder="Instruções para a IA..."
                  />
                </div>
              )}

              {selectedNode.type === 'choice' && (
                <>
                  <div className="space-y-3">
                    <Label>Opções (Palavras-chave)</Label>
                    {(selectedNode.data as any).options?.map((opt: any, i: number) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={opt.label}
                          onChange={(e) => {
                            const newOpts = [...(selectedNode.data as any).options];
                            newOpts[i].label = e.target.value;
                            updateNodeData(selectedNode.id, { options: newOpts });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newOpts = (selectedNode.data as any).options.filter((_: any, idx: number) => idx !== i);
                            updateNodeData(selectedNode.id, { options: newOpts });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => {
                        const newOpts = [...((selectedNode.data as any).options || []), { label: 'Nova Opção' }];
                        updateNodeData(selectedNode.id, { options: newOpts });
                      }}
                    >
                      Adicionar Opção
                    </Button>
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Label>Máx. tentativas antes de transbordar</Label>
                    <Input
                      type="number"
                      min={0}
                      value={(selectedNode.data as any).max_retries ?? 2}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { max_retries: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem ao não entender</Label>
                    <Textarea
                      rows={2}
                      value={(selectedNode.data as any).retry_message || ''}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { retry_message: e.target.value })
                      }
                      placeholder="Ex: Não entendi, por favor escolha uma das opções."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ação ao esgotar tentativas</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={(selectedNode.data as any).on_exhaust ?? 'transfer'}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { on_exhaust: e.target.value })
                      }
                    >
                      <option value="transfer">Transbordar para humano</option>
                      <option value="end">Encerrar (abandono)</option>
                    </select>
                  </div>
                </>
              )}

              {selectedNode.type === 'timeout' && (
                <>
                  <div className="space-y-2">
                    <Label>Tempo de espera (segundos)</Label>
                    <Input
                      type="number"
                      min={10}
                      value={(selectedNode.data as any).wait_seconds ?? 120}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { wait_seconds: Number(e.target.value) })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Tempo sem resposta antes de enviar uma cutucada.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem de cutucada</Label>
                    <Textarea
                      rows={2}
                      value={(selectedNode.data as any).nudge_message || ''}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { nudge_message: e.target.value })
                      }
                      placeholder="Ex: Você ainda está aí?"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máx. tentativas de cutucada</Label>
                    <Input
                      type="number"
                      min={0}
                      value={(selectedNode.data as any).max_retries ?? 2}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { max_retries: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ação ao esgotar</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={(selectedNode.data as any).on_exhaust ?? 'end'}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { on_exhaust: e.target.value })
                      }
                    >
                      <option value="end">Encerrar (abandono)</option>
                      <option value="transfer">Transbordar para humano</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem final (encerramento)</Label>
                    <Textarea
                      rows={2}
                      value={(selectedNode.data as any).end_message || ''}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { end_message: e.target.value })
                      }
                      placeholder="Enviada quando encerrar por abandono."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem ao transbordar</Label>
                    <Textarea
                      rows={2}
                      value={(selectedNode.data as any).transfer_message || ''}
                      onChange={(e) =>
                        updateNodeData(selectedNode.id, { transfer_message: e.target.value })
                      }
                      placeholder="Enviada quando passar para atendente humano."
                    />
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
