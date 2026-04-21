-- Create the missing trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, name, email)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data ->> 'name', split_part(u.email, '@', 1)),
  u.email
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = CASE
        WHEN public.profiles.name IS NULL OR public.profiles.name = ''
          THEN EXCLUDED.name
        ELSE public.profiles.name
      END;