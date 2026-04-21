

## Problema

Ao enviar mensagem pelo painel, ela é apenas inserida na tabela `messages` (gravada localmente), mas **nunca é enviada para a API do Whapi**. Por isso o destinatário no WhatsApp não recebe nada.

Hoje em `src/lib/http.ts → sendMessage`:
```ts
await supabase.from("messages").insert({ conversation_id, content, from_me: true, ... })
```
Não há nenhuma chamada para `https://gate.whapi.cloud/messages/text`.

## Solução

Criar uma rota **server-side** (`/api/whapi/send`) que:
1. Autentica o usuário e valida que ele é membro do workspace da conversa (RLS via `requireSupabaseAuth`).
2. Busca o `external_id` (chat_id do WhatsApp) da conversa e o `token`/`api_url` do `workspace_integrations` (com `supabaseAdmin`, pois `token` é admin-only por RLS).
3. Faz `POST {api_url}/messages/text` com `Authorization: Bearer {token}` enviando `{ to: chatId, body: content }`.
4. Em sucesso: insere a mensagem em `messages` com `external_id` retornado pelo Whapi, `from_me: true` (dedupe contra o webhook que ecoa a mensagem enviada).
5. Em falha: retorna erro estruturado com status do Whapi e a mensagem do erro para o frontend exibir.

Atualizar `api.sendMessage` no frontend para chamar `fetch("/api/whapi/send", ...)` em vez de fazer insert direto.

## Arquivos

**Criar `src/routes/api/whapi/send.ts`** — rota POST autenticada:
- Body: `{ conversationId, content }` (validado com Zod: `content` 1–4096 chars).
- Lê conversa via cliente autenticado (RLS garante que usuário é membro).
- Lê integração com `supabaseAdmin` (para acessar `token`).
- Verifica `enabled = true` e `token` presente; senão retorna 400 com mensagem clara.
- Verifica `external_id` da conversa; senão retorna 400 ("conversa sem chat_id externo").
- Faz `fetch` para `${api_url}/messages/text` com body `{ to, body }`. Para grupos (`@g.us`), mesmo endpoint funciona.
- Trata erros de rede/HTTP do Whapi e loga (status, corpo) sem expor token.
- Insere em `messages` (`from_me: true`, `sender_name: profile.name`, `external_id` do Whapi, `sender_phone` se disponível) e atualiza `last_message`/`last_message_at` na conversa.
- Retorna `{ ok: true, message: {...} }` mapeado no formato `Message`.

**Editar `src/lib/http.ts`**:
- Substituir `api.sendMessage` para fazer `fetch("/api/whapi/send", { method: "POST", body: JSON.stringify({ conversationId, content }) })`, propagando cookie de auth automaticamente (mesmo origin).
- Tratar resposta de erro: `if (!res.ok) throw new Error(json.error)` para que o `ChatArea` exiba toast.

**Webhook `whapi-webhook.ts`**: nenhuma mudança. O dedupe por `external_id` já existente garante que a mensagem retornada pelo Whapi (eco do envio com `from_me=true`) não seja inserida em duplicata.

## Detalhes técnicos

- **Endpoint Whapi**: `POST https://gate.whapi.cloud/messages/text` com header `Authorization: Bearer <token>` e body `{ "to": "<chat_id>", "body": "<text>" }`. Resposta esperada: `{ sent: true, message: { id, chat_id, ... } }`.
- **Por que server-side**: o `token` do Whapi é segredo por workspace, e a RLS de `workspace_integrations` é admin-only — não dá para ler o token do browser. Além disso, evitamos CORS contra `gate.whapi.cloud`.
- **Auth**: usar middleware `requireSupabaseAuth` para garantir que `userId` pertence ao workspace da conversa antes de buscar token (defesa em profundidade contra IDOR).
- **Dedupe**: ao inserir com `external_id` retornado pelo Whapi, qualquer eco posterior do webhook bate na unique constraint `messages_external_id_unique` e é silenciosamente ignorado (código `23505` já tratado no webhook).
- **Realtime**: o `ChatArea` que faz polling pegará a mensagem inserida automaticamente; nenhum trabalho extra de UI necessário.

