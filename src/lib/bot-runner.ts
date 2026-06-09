import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function processBotMessage(conversationId: string, messageContent: string) {
  console.log(`🤖 Processando mensagem para bot: ${conversationId} | Content: ${messageContent}`);
  
  // 1. Check if conversation is bot-active
  const { data: conv } = await supabaseAdmin
    .from("conversations")
    .select("id, bot_active, workspace_id, external_id")
    .eq("id", conversationId)
    .single();

  if (!conv || !conv.bot_active) {
    console.log("🤖 Bot inativo para esta conversa ou conversa não encontrada.");
    return;
  }

  // 2. Get bot state or create it
  let { data: state } = await supabaseAdmin
    .from("bot_states")
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  // 3. Get flow
  const flowId = state?.flow_id || (await getDefaultFlowId(conv.workspace_id));
  if (!flowId) {
    console.log("🤖 Nenhum fluxo configurado para este workspace.");
    return;
  }

  const { data: flow } = await supabaseAdmin
    .from("bot_flows")
    .select("definition")
    .eq("id", flowId)
    .single();

  if (!flow) {
    console.log("🤖 Fluxo não encontrado.");
    return;
  }

  const definition = flow.definition as any;
  let currentBlockId = state?.current_block_id;
  
  // Se não tem estado, começa do início
  if (!currentBlockId) {
    currentBlockId = definition.start_block;
    await upsertBotState(conversationId, flowId, currentBlockId);
    await executeBlock(conv, definition, currentBlockId);
    return;
  }

  // Processar input do usuário baseado no bloco atual
  const currentBlock = definition.blocks.find((b: any) => b.id === currentBlockId);
  if (!currentBlock) return;

  let nextBlockId = null;

  if (currentBlock.type === "choice") {
    const input = messageContent.trim();
    const option = currentBlock.options?.find((o: any) => o.label === input);
    if (option) {
      nextBlockId = option.next;
    } else {
      // Repete a mensagem se a opção for inválida
      await sendBotResponse(conv.workspace_id, conv.external_id, "Opção inválida. " + currentBlock.content);
      return;
    }
  } else {
    nextBlockId = currentBlock.next;
  }

  if (nextBlockId) {
    await upsertBotState(conversationId, flowId, nextBlockId);
    await executeBlock(conv, definition, nextBlockId);
  }
}

async function executeBlock(conv: any, definition: any, blockId: string) {
  const block = definition.blocks.find((b: any) => b.id === blockId);
  if (!block) return;

  // Envia a mensagem do bloco
  if (block.content) {
    await sendBotResponse(conv.workspace_id, conv.external_id, block.content);
  }

  // Lógica específica por tipo
  if (block.type === "transfer") {
    if (block.transfer_to === "human") {
      await supabaseAdmin
        .from("conversations")
        .update({ bot_active: false, status: "PENDING" })
        .eq("id", conv.id);
      console.log("🤖 Transbordo humano realizado.");
    }
  } else if (block.type === "message" && block.next) {
    // Se for apenas mensagem, avança automaticamente se houver um próximo
    await upsertBotState(conv.id, null, block.next);
    await executeBlock(conv, definition, block.next);
  }
}

async function upsertBotState(conversationId: string, flowId: string | null, currentBlockId: string) {
  const payload: any = { 
    conversation_id: conversationId, 
    current_block_id: currentBlockId 
  };
  if (flowId) payload.flow_id = flowId;

  const { error } = await supabaseAdmin
    .from("bot_states")
    .upsert(payload, { onConflict: "conversation_id" });
    
  if (error) console.error("🤖 Erro ao salvar estado do bot:", error.message);
}

async function sendBotResponse(workspaceId: string, externalId: string, content: string) {
  // 1. Get Whapi integration
  const { data: integration } = await supabaseAdmin
    .from("workspace_integrations")
    .select("api_url, token")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whapi")
    .single();

  if (!integration?.token) return;

  const apiUrl = (integration.api_url as string).replace(/\/$/, "");
  const whapiUrl = `${apiUrl}/messages/text`;

  try {
    await fetch(whapiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: externalId, body: content }),
    });
    console.log(`🤖 Resposta enviada para ${externalId}: ${content}`);
  } catch (e) {
    console.error("🤖 Erro ao enviar resposta do bot:", e);
  }
}

async function getDefaultFlowId(workspaceId: string) {
  const { data } = await supabaseAdmin
    .from("workspaces")
    .select("default_bot_flow_id")
    .eq("id", workspaceId)
    .single();
  
  if (data?.default_bot_flow_id) return data.default_bot_flow_id;
  
  // Fallback: pega o primeiro fluxo ativo do workspace
  const { data: firstFlow } = await supabaseAdmin
    .from("bot_flows")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
    
  return (firstFlow as any)?.id;
}
