

## Gerenciamento de Equipe — Edição, Status e Perfil Próprio

### O que vai mudar

**1. Admins poderão, na tela `/team`:**
- Editar o **nome** de qualquer membro do workspace.
- **Ativar/desativar** um membro (desativado não consegue acessar a inbox nem enviar mensagens, mas o histórico e a conta continuam preservados — diferente de "Remover", que apaga o vínculo).
- Alterar o **papel** (ADMIN/AGENT) — já existe, será mantido.
- Remover o membro — já existe, será mantido.

**2. Agentes (não-admins) poderão:**
- Editar o **próprio nome**.
- Alterar a **própria senha**.
- Ver os próprios dados (e-mail, papel, data de entrada) em modo somente leitura.

**3. UX nova na tela `/team`:**
- Nova coluna **"Ações"** com botão **Editar** (ícone lápis) ao lado de **Remover** — abre um Dialog para alterar nome/status do membro.
- Linha do próprio usuário ganha botão **"Editar meu perfil"** que abre o mesmo Dialog em modo "self" (sem campo de status, sem campo de papel, com seção extra de troca de senha).
- Membros desativados aparecem com badge cinza "Desativado" e linha esmaecida.

### Mudanças técnicas

**Banco (migration nova):**
- Adicionar coluna `memberships.active boolean NOT NULL DEFAULT true`.
  - Por que em `memberships` e não em `profiles`: o status é por-workspace (um usuário pode estar ativo num workspace e desativado em outro no futuro), e desativar pelo membership não destrói a conta auth.
- Adicionar coluna `profiles.email text` (sincronizada via trigger `handle_new_user` atualizada) para que o admin veja o e-mail de cada membro no painel — hoje a coluna `email` em `TeamMember` vem vazia.
- Atualizar trigger `handle_new_user` para preencher `email` no profile.
- Backfill: rodar `UPDATE profiles SET email = au.email FROM auth.users au WHERE profiles.id = au.id`.
- Adicionar política RLS de **gate de acesso por `active`**: criar função `is_active_member(_workspace_id uuid)` (SECURITY DEFINER) que retorna true só se o usuário for membro **e** `active = true`. Substituir as policies de `conversations` e `messages` que hoje usam `is_member_of` para usar `is_active_member` — assim um agente desativado fica bloqueado de fato no banco, não só na UI.

**Tipos (`src/lib/types.ts`):**
- Adicionar `active: boolean` em `TeamMember`.
- Status passa a derivar de `active` (`ACTIVE` se true, `DISABLED` se false).

**API (`src/lib/http.ts`):**
- `updateMemberActive(userId, active)` — admin atualiza `memberships.active`.
- `updateMemberName(userId, name)` — admin atualiza `profiles.name` (precisa de policy nova: admin do workspace pode atualizar profile de membros do workspace).
- `updateOwnProfile({ name })` — agente atualiza o próprio `profiles.name` (RLS já permite).
- `updateOwnPassword(newPassword)` — chama `supabase.auth.updateUser({ password })`.
- Atualizar `manualListUsers` para trazer `active` e `email` do profile.

**RLS adicional em `profiles`:**
- Nova policy "Admins can update workspace member profiles" — `is_admin_of` cruzado com membership do alvo.

**UI:**
- `src/routes/team.tsx`: nova coluna Ações com botão Editar; novo `EditMemberDialog` (usa `Dialog` do shadcn) com campos nome + toggle ativo + select de papel; novo `EditSelfDialog` com nome + senha atual/nova + confirmação.
- `ConversationList`/`ChatArea`: o select de "Assign" filtra `active = true` para não atribuir conversa a alguém desativado.

### Fluxo do usuário

```text
Admin
 └─ /team
     ├─ Vê lista de membros com badges Ativo/Desativado
     ├─ Clica "Editar" em qualquer linha
     │   └─ Dialog: nome + papel + toggle Ativo
     └─ Clica "Editar meu perfil" na própria linha
         └─ Dialog self: nome + nova senha

Agente
 └─ /team
     ├─ Vê lista (somente leitura)
     └─ Clica "Editar meu perfil"
         └─ Dialog self: nome + nova senha
```

### Fora do escopo

- Convite por e-mail real (continua exigindo edge function com service-role; segue como follow-up).
- Avatar/foto de perfil.
- Auditoria de quem alterou o quê.

