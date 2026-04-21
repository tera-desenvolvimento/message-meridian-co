
-- Add external_id and sender_phone to messages
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone TEXT;

-- Unique constraint to prevent duplicate inbound messages per conversation
CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_external_id_uniq
  ON public.messages (conversation_id, external_id)
  WHERE external_id IS NOT NULL;

-- Add external_id to conversations (phone number or group id from WhatsApp)
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS conversations_workspace_external_id_uniq
  ON public.conversations (workspace_id, external_id)
  WHERE external_id IS NOT NULL;
