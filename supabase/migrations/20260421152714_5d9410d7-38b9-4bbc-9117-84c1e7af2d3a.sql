CREATE TABLE public.workspace_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'whapi',
  api_url TEXT NOT NULL DEFAULT 'https://gate.whapi.cloud',
  token TEXT,
  webhook_secret TEXT,
  phone_number TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view workspace integrations"
  ON public.workspace_integrations FOR SELECT TO authenticated
  USING (public.is_admin_of(workspace_id));

CREATE POLICY "Admins can insert workspace integrations"
  ON public.workspace_integrations FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of(workspace_id));

CREATE POLICY "Admins can update workspace integrations"
  ON public.workspace_integrations FOR UPDATE TO authenticated
  USING (public.is_admin_of(workspace_id))
  WITH CHECK (public.is_admin_of(workspace_id));

CREATE POLICY "Admins can delete workspace integrations"
  ON public.workspace_integrations FOR DELETE TO authenticated
  USING (public.is_admin_of(workspace_id));

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER workspace_integrations_updated_at
  BEFORE UPDATE ON public.workspace_integrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();