ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_updated_at timestamptz;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_avatar_url text;

CREATE INDEX IF NOT EXISTS idx_conversations_avatar_updated
  ON public.conversations (avatar_updated_at);