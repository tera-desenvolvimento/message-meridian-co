-- 1. Add active column to memberships
ALTER TABLE public.memberships
ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 2. Add email column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email text;

-- 3. Backfill emails from auth.users
UPDATE public.profiles p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id AND (p.email IS NULL OR p.email = '');

-- 4. Update handle_new_user trigger function to include email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$function$;

-- 5. Create is_active_member function
CREATE OR REPLACE FUNCTION public.is_active_member(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE workspace_id = _workspace_id
      AND user_id = auth.uid()
      AND active = true
  );
$function$;

-- 6. Replace conversations RLS policies to use is_active_member
DROP POLICY IF EXISTS "Members can view workspace conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can create workspace conversations" ON public.conversations;
DROP POLICY IF EXISTS "Members can update workspace conversations" ON public.conversations;

CREATE POLICY "Members can view workspace conversations"
ON public.conversations FOR SELECT TO authenticated
USING (public.is_active_member(workspace_id));

CREATE POLICY "Members can create workspace conversations"
ON public.conversations FOR INSERT TO authenticated
WITH CHECK (public.is_active_member(workspace_id));

CREATE POLICY "Members can update workspace conversations"
ON public.conversations FOR UPDATE TO authenticated
USING (public.is_active_member(workspace_id))
WITH CHECK (public.is_active_member(workspace_id));

-- 7. Replace messages RLS policies to use is_active_member
DROP POLICY IF EXISTS "Members can view messages in their workspace" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages in their workspace" ON public.messages;

CREATE POLICY "Members can view messages in their workspace"
ON public.messages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = messages.conversation_id
    AND public.is_active_member(c.workspace_id)
));

CREATE POLICY "Members can send messages in their workspace"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.conversations c
  WHERE c.id = messages.conversation_id
    AND public.is_active_member(c.workspace_id)
));

-- 8. New RLS policy: admins can update workspace member profiles
CREATE POLICY "Admins can update workspace member profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id = profiles.id
    AND public.is_admin_of(m.workspace_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.user_id = profiles.id
    AND public.is_admin_of(m.workspace_id)
));