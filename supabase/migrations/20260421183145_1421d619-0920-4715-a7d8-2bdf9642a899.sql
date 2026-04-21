CREATE TYPE public.conversation_priority AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

ALTER TABLE public.conversations
  ADD COLUMN priority public.conversation_priority NOT NULL DEFAULT 'NORMAL';