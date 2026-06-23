ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.workspaces ALTER COLUMN created_by DROP NOT NULL;