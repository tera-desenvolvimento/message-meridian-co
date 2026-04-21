ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS whatsapp_number text;

CREATE UNIQUE INDEX IF NOT EXISTS workspaces_whatsapp_number_unique
ON public.workspaces (whatsapp_number)
WHERE whatsapp_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS messages_external_id_unique
ON public.messages (external_id)
WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_workspace_external_unique
ON public.conversations (workspace_id, external_id)
WHERE external_id IS NOT NULL;