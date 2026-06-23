ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '3 days'),
  ADD COLUMN IF NOT EXISTS subscription_active boolean NOT NULL DEFAULT false;