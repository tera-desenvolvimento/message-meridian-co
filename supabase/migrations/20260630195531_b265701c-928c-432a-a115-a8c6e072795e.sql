
CREATE POLICY "chat-media authenticated read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'chat-media');

CREATE POLICY "chat-media authenticated insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "chat-media service role all"
ON storage.objects FOR ALL TO service_role
USING (bucket_id = 'chat-media') WITH CHECK (bucket_id = 'chat-media');
