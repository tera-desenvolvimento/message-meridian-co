import { supabaseAdmin } from "@/integrations/supabase/client.server";

const MAX_EXECUTION_DEPTH = 25;
const AI_HISTORY_LIMIT = 12;
const AI_TIMEOUT_MS = 20_000;

type Conv = {
  id: string;
  bot_active: boolean | null;
  workspace_id: string | null;
  external_id: string | null;
};

export async function processBotMessage(conversationId: string, messageContent: string) {
  try {
    console.log(`🤖 Processando mensagem para bot: ${conversationId}`);

    const { data: conv } = await supabaseAdmin
      .from("conversations")
      .select("id, bot_active, workspace_id, external_id")
      .eq("id", conversationId)
      .single();

    if (!conv || !conv.bot_active) {
      console.log("🤖 Bot inativo ou conversa não encontrada.");
      return;
    }

    const { data: state } = await supabaseAdmin
      .from("bot_states")
      .select("*")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    const flowId: string | null =
      state?.flow_id || (await getDefaultFlowId(conv.workspace_id!));
    if (!flowId) {
      console.log("🤖 Nenhum fluxo configurado para este workspace.");
      return;
    }

    const { data: flow } = await supabaseAdmin
      .from("bot_flows")
      .select("definition")
      .eq("id", flowId)
      .single();

    const definition = flow?.definition as any;
    if (!definition?.blocks?.length) {
      console.log("🤖 Fluxo sem blocos.");
      return;
    }

    let currentBlockId: string | null = state?.current_block_id ?? null;

    if (!currentBlockId) {
      currentBlockId = definition.start_block ?? definition.blocks[0].id;
      if (currentBlockId) {
        await upsertBotState(conversationId, flowId, currentBlockId);
        await executeBlock(conv as Conv, definition, currentBlockId, 0);
      }
      return;
    }

    const currentBlock = definition.blocks.find((b: any) => b.id === currentBlockId);
    if (!currentBlock) {
      console.warn(`🤖 Bloco atual ${currentBlockId} não existe mais. Resetando.`);
      await upsertBotState(conversationId, flowId, definition.start_block);
      return;
    }

    let nextBlockId: string | null = null;

    if (currentBlock.type === "choice") {
      const input = messageContent.trim().toLowerCase();
      const option = currentBlock.options?.find(
        (o: any) => String(o.label ?? "").trim().toLowerCase() === input,
      );
      if (option?.next) {
        nextBlockId = option.next;
      } else {
        if (conv.workspace_id && conv.external_id) {
          await sendBotResponse(
            conv.workspace_id,
            conv.external_id,
            `Opção inválida. ${currentBlock.content ?? ""}`.trim(),
          );
        }
        return;
      }
    } else if (currentBlock.type === "ai") {
      // Bloco de IA: gera resposta e avança automaticamente.
      await runAiBlock(conv as Conv, currentBlock, messageContent);
      nextBlockId = currentBlock.next ?? null;
    } else {
      nextBlockId = currentBlock.next ?? null;
    }

    if (nextBlockId) {
      await upsertBotState(conversationId, flowId, nextBlockId);
      await executeBlock(conv as Conv, definition, nextBlockId, 0);
    }
  } catch (e) {
    console.error("🤖 Erro inesperado em processBotMessage:", e);
  }
}

async function executeBlock(
  conv: Conv,
  definition: any,
  blockId: string,
  depth: number,
) {
  if (depth > MAX_EXECUTION_DEPTH) {
    console.warn("🤖 Profundidade máxima de execução atingida — possível loop.");
    return;
  }
  const block = definition.blocks.find((b: any) => b.id === blockId);
  if (!block) return;

  try {
    if (block.type === "ai") {
      // Em execução automática (sem input do usuário) usamos string vazia.
      await runAiBlock(conv, block, "");
    } else if (block.content && conv.workspace_id && conv.external_id) {
      await sendBotResponse(conv.workspace_id, conv.external_id, block.content);
    }

    if (block.type === "transfer") {
      if (block.transfer_to === "human" || !block.transfer_to) {
        await supabaseAdmin
          .from("conversations")
          .update({ bot_active: false, status: "PENDING", assigned_to: null })
          .eq("id", conv.id);
        console.log("🤖 Transbordo humano realizado.");
      }
      return;
    }

    // Avança automaticamente quando o bloco tem `next` e não exige input do usuário.
    if (block.next && (block.type === "message" || block.type === "ai")) {
      await upsertBotState(conv.id, null, block.next);
      await executeBlock(conv, definition, block.next, depth + 1);
    }
  } catch (e) {
    console.error(`🤖 Erro ao executar bloco ${blockId}:`, e);
  }
}

async function upsertBotState(
  conversationId: string,
  flowId: string | null,
  currentBlockId: string,
) {
  const payload: any = {
    conversation_id: conversationId,
    current_block_id: currentBlockId,
  };
  if (flowId) payload.flow_id = flowId;
  const { error } = await supabaseAdmin
    .from("bot_states")
    .upsert(payload, { onConflict: "conversation_id" });
  if (error) console.error("🤖 Erro ao salvar estado do bot:", error.message);
}

async function sendBotResponse(workspaceId: string, externalId: string, content: string) {
  if (!content?.trim()) return;
  const { data: integration } = await supabaseAdmin
    .from("workspace_integrations")
    .select("api_url, token")
    .eq("workspace_id", workspaceId)
    .eq("provider", "whapi")
    .maybeSingle();

  if (!integration?.token || !integration.api_url) {
    console.warn("🤖 Whapi não configurado neste workspace.");
    return;
  }

  const apiUrl = integration.api_url.replace(/\/$/, "");
  try {
    const res = await fetch(`${apiUrl}/messages/text`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ to: externalId, body: content }),
    });
    if (!res.ok) {
      console.error("🤖 Whapi respondeu erro:", res.status, await res.text());
    } else {
      console.log(`🤖 Resposta enviada para ${externalId}.`);
    }
  } catch (e) {
    console.error("🤖 Erro ao enviar resposta do bot:", e);
  }
}

async function getDefaultFlowId(workspaceId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("workspaces")
    .select("default_bot_flow_id")
    .eq("id", workspaceId)
    .single();
  if ((data as any)?.default_bot_flow_id) return (data as any).default_bot_flow_id;

  const { data: firstFlow } = await supabaseAdmin
    .from("bot_flows")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (firstFlow as any)?.id || null;
}

// ===== IA =====

type AiConfig = {
  provider: "gemini" | "openai";
  model: string;
  token: string;
};

async function loadAiConfig(workspaceId: string): Promise<AiConfig | null> {
  const { data } = await supabaseAdmin
    .from("workspace_integrations")
    .select("api_url, token, phone_number, enabled")
    .eq("workspace_id", workspaceId)
    .eq("provider", "ai")
    .maybeSingle();
  if (!data || !data.enabled || !data.token) return null;
  const provider = data.phone_number === "openai" ? "openai" : "gemini";
  return {
    provider,
    model: data.api_url || (provider === "openai" ? "gpt-5-mini" : "gemini-2.5-flash"),
    token: data.token,
  };
}

async function loadHistory(conversationId: string) {
  const { data } = await supabaseAdmin
    .from("messages")
    .select("content, from_me, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(AI_HISTORY_LIMIT);
  return (data ?? []).reverse().map((m) => ({
    role: m.from_me ? ("assistant" as const) : ("user" as const),
    content: m.content ?? "",
  }));
}

async function runAiBlock(conv: Conv, block: any, latestUserMessage: string) {
  if (!conv.workspace_id || !conv.external_id) return;

  const cfg = await loadAiConfig(conv.workspace_id);
  const fallback = (block.content as string) || "Desculpe, não consegui processar sua mensagem agora.";

  if (!cfg) {
    console.warn("🤖 IA não configurada — usando fallback do bloco.");
    await sendBotResponse(conv.workspace_id, conv.external_id, fallback);
    return;
  }

  const systemPrompt =
    (block.system_prompt as string) ||
    (block.content as string) ||
    "Você é um assistente de atendimento ao cliente. Responda de forma clara, breve e cordial em português.";

  const history = await loadHistory(conv.id);
  if (latestUserMessage && (!history.length || history[history.length - 1].role !== "user")) {
    history.push({ role: "user", content: latestUserMessage });
  }

  try {
    const reply = await callAi(cfg, systemPrompt, history);
    const text = (reply || "").trim() || fallback;
    await sendBotResponse(conv.workspace_id, conv.external_id, text);
  } catch (e) {
    console.error("🤖 IA falhou, usando fallback:", e);
    await sendBotResponse(conv.workspace_id, conv.external_id, fallback);
  }
}

async function callAi(
  cfg: AiConfig,
  systemPrompt: string,
  history: { role: "user" | "assistant"; content: string }[],
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    if (cfg.provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.token}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages: [{ role: "system", content: systemPrompt }, ...history],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
      const json = await res.json();
      return json?.choices?.[0]?.message?.content ?? "";
    }

    // Gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      cfg.model,
    )}:generateContent?key=${encodeURIComponent(cfg.token)}`;
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
        contents: history.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((p: any) => p?.text ?? "").join("").trim();
  } finally {
    clearTimeout(timer);
  }
}
