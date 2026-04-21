

## Problema identificado

O webhook do Whapi **nunca chega ao seu app**. Testei o endpoint diretamente e o servidor responde **HTTP 302** redirecionando para o login do Lovable:

```
POST /api/public/whapi-webhook
→ 302 Location: lovable.dev/auth-bridge?...
```

Isso acontece porque a URL atual configurada no Whapi é a do **preview** (`id-preview--...lovable.app`), que exige autenticação. Webhooks externos como o Whapi não fazem login — eles recebem o 302, desistem, e o payload nunca é processado. Por isso `messages` está com 0 registros e não há logs no servidor.

A regra `/api/public/*` (sem auth) **só funciona no site publicado**. Hoje o projeto não está publicado.

Tudo o mais está correto: workspace tem `whatsapp_number = 557996477532`, integração `enabled=true`, secret e token salvos, código do handler funcional.

## Solução

### Passo 1 — Publicar o projeto (você faz)
Clicar em **Publish** no canto superior direito do editor Lovable. Isso ativa a URL estável:

```
https://project--b4d9d4b8-7326-4928-873e-3f14d3b34c62.lovable.app/api/public/whapi-webhook
```

Essa URL **não exige autenticação** para rotas em `/api/public/*` e é imutável.

### Passo 2 — Atualizar a URL do Webhook na UI (eu faço)
Em `src/routes/settings.tsx`, trocar `window.location.origin` (que aponta para a URL de preview com auth) pela URL estável publicada baseada em `VITE_SUPABASE_PROJECT_ID`/Lovable project id, mostrando claramente:

- **URL para colar no Whapi:** `https://project--b4d9d4b8-7326-4928-873e-3f14d3b34c62.lovable.app/api/public/whapi-webhook`
- Aviso: "Funciona somente após publicar o projeto."

### Passo 3 — Reconfigurar no painel Whapi (você faz)
1. Acessar painel do Whapi → Channel Settings → Webhooks
2. Substituir a URL antiga pela nova URL **publicada** mostrada nas Configurações
3. Header: `x-webhook-secret: <o secret salvo>`
4. Eventos: `messages` (incoming + outgoing)
5. Salvar

### Passo 4 — Validar (eu faço após publicar)
Executar `curl` contra a URL publicada simulando um payload Whapi e confirmar:
- Response **200 OK** (não mais 302)
- Linha aparece em `messages` no banco
- Logs do servidor mostram `🔥 WEBHOOK RECEBIDO` … `✅ MENSAGEM SALVA`

## Detalhes técnicos

- **Por que `id-preview--...` falha**: domínio de preview é privado por padrão. Mesmo rotas marcadas como públicas pelo TanStack são interceptadas pelo edge do Lovable que injeta o auth-bridge antes do worker rodar o handler.
- **Por que `project--{id}.lovable.app` funciona**: serve o build publicado, e o edge do Lovable respeita o prefixo `/api/public/*` deixando passar requisições não autenticadas direto ao handler.
- **Sem mudança de código no handler**: o handler atual já está correto (identificação por número, dedupe por `external_id`, RLS bypass via `supabaseAdmin`, secret validation opcional, logs detalhados).
- **Realtime do painel**: assim que mensagens forem inseridas, a tela de inbox que já usa polling/realtime vai exibi-las automaticamente.

## Arquivos a editar

- `src/routes/settings.tsx` — exibir a URL publicada estável (não a do preview) na seção "URL do Webhook" e adicionar instrução explicando que é necessário publicar.

