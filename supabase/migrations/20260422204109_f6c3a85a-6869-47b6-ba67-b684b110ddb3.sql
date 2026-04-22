INSERT INTO public.profiles (id, name, email)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)) AS name,
  u.email
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;