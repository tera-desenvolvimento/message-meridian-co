ALTER TABLE public.workspaces
ADD COLUMN IF NOT EXISTS created_by uuid;

UPDATE public.workspaces w
SET created_by = m.user_id
FROM public.memberships m
WHERE m.workspace_id = w.id
  AND m.role = 'ADMIN'
  AND w.created_by IS NULL;

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces with themselves as creator" ON public.workspaces;

CREATE POLICY "Users can create workspaces with themselves as creator"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL AND NEW.created_by = auth.uid() THEN
    INSERT INTO public.memberships (user_id, workspace_id, role)
    VALUES (NEW.created_by, NEW.id, 'ADMIN')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_add_creator_admin ON public.workspaces;
CREATE TRIGGER workspaces_add_creator_admin
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_creator_as_admin();

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;