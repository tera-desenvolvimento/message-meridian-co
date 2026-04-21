CREATE OR REPLACE FUNCTION public.add_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.memberships (user_id, workspace_id, role)
    VALUES (auth.uid(), NEW.id, 'ADMIN')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspaces_add_creator_admin ON public.workspaces;
CREATE TRIGGER workspaces_add_creator_admin
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.add_creator_as_admin();