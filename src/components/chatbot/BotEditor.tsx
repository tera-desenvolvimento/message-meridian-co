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

// --- Custom Nodes (Blip-style) ---

const ACCENTS: Record<string, string> = {
  message: 'bg-sky-600',
  choice: 'bg-violet-600',
  timeout: 'bg-amber-600',
  transfer: 'bg-emerald-600',
  ai: 'bg-fuchsia-600',
};

const BaseNode = ({ title, accent, selected, children, footer }: any) => (
  <div
    className={`min-w-[170px] overflow-hidden rounded-md border shadow-lg transition-all ${
      selected ? 'border-primary ring-2 ring-primary/40' : 'border-zinc-700'
    } bg-zinc-800`}
  >
    <div className={`px-3 py-2 text-center text-[11px] font-semibold text-white ${accent}`}>
      {title}
    </div>
    {children && <div className="px-3 py-2 text-[10px] text-zinc-300">{children}</div>}
    {footer}
  </div>
);

const MessageNode = ({ data, selected, type }: NodeProps) => (
  <BaseNode title={(data.name as string) || 'Mensagem'} accent={ACCENTS[type]} selected={selected}>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
    <p className="line-clamp-2 text-zinc-400">{(data.content as string) || 'Sem mensagem'}</p>
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
  </BaseNode>
);

const ChoiceNode = ({ data, selected, type }: NodeProps) => (
  <BaseNode title={(data.name as string) || 'Decisão'} accent={ACCENTS[type]} selected={selected}>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
    <p className="mb-1 line-clamp-2 text-zinc-400">{(data.content as string) || 'Pergunta'}</p>
    <div className="space-y-1">
      {(data.options as any[])?.map((opt, i) => (
        <div key={i} className="relative rounded bg-zinc-900/70 px-2 py-1 text-zinc-200">
          {opt.label}
          <Handle
            type="source"
            position={Position.Right}
            id={`opt-${i}`}
            style={{ top: '50%' }}
            className="!h-2 !w-2 !bg-violet-400 !border-0"
          />
        </div>
      ))}
    </div>
  </BaseNode>
);

const TransferNode = ({ data, selected, type }: NodeProps) => (
  <BaseNode title={(data.name as string) || 'Transbordo'} accent={ACCENTS[type]} selected={selected}>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
    <div className="flex items-center gap-1.5 text-zinc-300">
      <UserPlus className="h-3 w-3" /> Atendimento humano
    </div>
  </BaseNode>
);

const AiNode = ({ data, selected, type }: NodeProps) => (
  <BaseNode title={(data.name as string) || 'IA'} accent={ACCENTS[type]} selected={selected}>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
    <p className="line-clamp-2 text-zinc-400">
      {(data.system_prompt as string) || 'Configure o prompt'}
    </p>
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
  </BaseNode>
);

const TimeoutNode = ({ data, selected, type }: NodeProps) => (
  <BaseNode title={(data.name as string) || 'Tempo de espera'} accent={ACCENTS[type]} selected={selected}>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-zinc-400 !border-0" />
    <p className="mb-1 text-zinc-400">
      {(data.wait_seconds as number) ?? 120}s · {(data.max_retries as number) ?? 2}x
    </p>
    <div className="space-y-1">
      <div className="relative rounded bg-emerald-500/10 px-2 py-1 text-emerald-400">
        Respondeu
        <Handle
          type="source"
          position={Position.Right}
          id="reply"
          style={{ top: '50%' }}
          className="!h-2 !w-2 !bg-emerald-400 !border-0"
        />
      </div>
      <div className="relative rounded bg-rose-500/10 px-2 py-1 text-rose-400">
        Esgotou
        <Handle
          type="source"
          position={Position.Right}
          id="exhaust"
          style={{ top: '50%' }}
          className="!h-2 !w-2 !bg-rose-400 !border-0"
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
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Salvando...' : 'Salvar Fluxo'}
        </Button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-48 border-r bg-surface flex flex-col gap-1 p-3">
          <span className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Blocos</span>
          <Button variant="ghost" size="sm" onClick={() => addNode('message')} className="justify-start gap-2">
            <MessageSquare className="h-3.5 w-3.5" /> Mensagem
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addNode('choice')} className="justify-start gap-2">
            <ListTree className="h-3.5 w-3.5" /> Decisão
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addNode('timeout')} className="justify-start gap-2">
            <Clock className="h-3.5 w-3.5" /> Tempo de espera
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addNode('transfer')} className="justify-start gap-2">
            <UserPlus className="h-3.5 w-3.5" /> Transbordo
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addNode('ai')} className="justify-start gap-2">
            <Sparkles className="h-3.5 w-3.5" /> IA
          </Button>
        </aside>
        <div className="flex-1 relative bg-zinc-950">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            defaultEdgeOptions={{
              animated: false,
              style: { stroke: '#71717a', strokeWidth: 1.5 },
            }}
            fitView
          >
            <Background color="#3f3f46" gap={20} size={1} />
            <Controls className="!bg-zinc-900 !border-zinc-700 [&_button]:!bg-zinc-900 [&_button]:!border-zinc-700 [&_button]:!text-zinc-300" />
            <MiniMap
              maskColor="rgba(9,9,11,0.7)"
              style={{ background: '#18181b', border: '1px solid #3f3f46' }}
              nodeColor={(n) =>
                ({
                  message: '#0284c7',
                  choice: '#7c3aed',
                  timeout: '#d97706',
                  transfer: '#059669',
                  ai: '#c026d3',
                } as any)[n.type as string] || '#52525b'
              }
            />
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

              {selectedNode.type === 'message' && (
                <div className="space-y-3 rounded-md border border-dashed p-3">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mídia (opcional)</Label>
                  <div className="space-y-2">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={(selectedNode.data as any).media_type ?? 'none'}
                      onChange={(e) => updateNodeData(selectedNode.id, { media_type: e.target.value })}
                    >
                      <option value="none">Nenhuma</option>
                      <option value="image">Imagem</option>
                      <option value="document">Documento</option>
                      <option value="video">Vídeo</option>
                      <option value="audio">Áudio</option>
                    </select>
                  </div>
                  {(selectedNode.data as any).media_type && (selectedNode.data as any).media_type !== 'none' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-xs">URL da mídia</Label>
                        <Input
                          value={(selectedNode.data as any).media_url || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { media_url: e.target.value })}
                          placeholder="https://..."
                        />
                        <p className="text-[11px] text-muted-foreground">Cole um link público (HTTPS) do arquivo.</p>
                      </div>
                      {(selectedNode.data as any).media_type === 'document' && (
                        <div className="space-y-2">
                          <Label className="text-xs">Nome do arquivo</Label>
                          <Input
                            value={(selectedNode.data as any).media_filename || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { media_filename: e.target.value })}
                            placeholder="documento.pdf"
                          />
                        </div>
                      )}
                    </>
                  )}
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
                    {(selectedNode.data as any).options?.map((opt: any, i: number) => {
                      const handleId = `opt-${i}`;
                      const currentEdge = edges.find(
                        (e) => e.source === selectedNode.id && e.sourceHandle === handleId,
                      );
                      return (
                        <div key={i} className="space-y-1 rounded-md border bg-muted/20 p-2">
                          <div className="flex gap-2">
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
                                const newOpts = (selectedNode.data as any).options.filter(
                                  (_: any, idx: number) => idx !== i,
                                );
                                updateNodeData(selectedNode.id, { options: newOpts });
                                setEdges((eds) =>
                                  eds.filter(
                                    (e) => !(e.source === selectedNode.id && e.sourceHandle === handleId),
                                  ),
                                );
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <select
                            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                            value={currentEdge?.target ?? ''}
                            onChange={(e) => {
                              const targetId = e.target.value;
                              setEdges((eds) => {
                                const filtered = eds.filter(
                                  (ed) => !(ed.source === selectedNode.id && ed.sourceHandle === handleId),
                                );
                                if (!targetId) return filtered;
                                return [
                                  ...filtered,
                                  {
                                    id: `${selectedNode.id}-${handleId}-${targetId}`,
                                    source: selectedNode.id,
                                    sourceHandle: handleId,
                                    target: targetId,
                                  } as Edge,
                                ];
                              });
                            }}
                          >
                            <option value="">— Conectar a um bloco —</option>
                            {nodes
                              .filter((n) => n.id !== selectedNode.id)
                              .map((n) => (
                                <option key={n.id} value={n.id}>
                                  {((n.data as any).name as string) ||
                                    `${n.type} (${n.id.slice(0, 6)})`}
                                </option>
                              ))}
                          </select>
                        </div>
                      );
                    })}
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
                  {(() => {
                    const exhaustEdge = edges.find(
                      (e) => e.source === selectedNode.id && e.sourceHandle === 'exhaust',
                    );
                    return (
                      <div className="space-y-2">
                        <Label>Conectar "esgotou" a um bloco (opcional)</Label>
                        <select
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={exhaustEdge?.target ?? ''}
                          onChange={(e) => {
                            const targetId = e.target.value;
                            setEdges((eds) => {
                              const filtered = eds.filter(
                                (ed) => !(ed.source === selectedNode.id && ed.sourceHandle === 'exhaust'),
                              );
                              if (!targetId) return filtered;
                              return [
                                ...filtered,
                                {
                                  id: `${selectedNode.id}-exhaust-${targetId}`,
                                  source: selectedNode.id,
                                  sourceHandle: 'exhaust',
                                  target: targetId,
                                } as Edge,
                              ];
                            });
                          }}
                        >
                          <option value="">— Nenhum (usar ação acima) —</option>
                          {nodes
                            .filter((n) => n.id !== selectedNode.id)
                            .map((n) => (
                              <option key={n.id} value={n.id}>
                                {((n.data as any).name as string) || `${n.type} (${n.id.slice(0, 6)})`}
                              </option>
                            ))}
                        </select>
                      </div>
                    );
                  })()}
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
