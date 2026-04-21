
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text,
  role public.user_role NOT NULL DEFAULT 'AGENT',
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX invitations_workspace_idx ON public.invitations(workspace_id);
CREATE INDEX invitations_token_idx ON public.invitations(token);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view workspace invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (public.is_admin_of(workspace_id));

CREATE POLICY "Admins can create workspace invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of(workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins can delete workspace invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (public.is_admin_of(workspace_id));
