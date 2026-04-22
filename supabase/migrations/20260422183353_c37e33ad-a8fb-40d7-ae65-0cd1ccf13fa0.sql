-- Resetar conversas privadas cujo nome foi corrompido pelo nome da nossa própria
-- linha (sender_name de mensagens from_me). Trocamos pelo número formatado para que
-- o próximo refresh-avatars/webhook busque o nome real do contato via API.
UPDATE public.conversations c
SET name = '+' || split_part(external_id, '@', 1),
    avatar_updated_at = NULL
WHERE c.type = 'PRIVATE'
  AND c.external_id LIKE '%@s.whatsapp.net'
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.conversation_id = c.id
      AND m.from_me = true
      AND m.sender_name = c.name
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.messages m2
    WHERE m2.conversation_id = c.id
      AND m2.from_me = false
      AND m2.sender_name IS NOT NULL
      AND m2.sender_name <> ''
      AND m2.sender_name = c.name
  );