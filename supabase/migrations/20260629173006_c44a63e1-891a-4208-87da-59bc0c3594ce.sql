-- Adicionar colunas a bot_states para suportar timeout/retry
ALTER TABLE public.bot_states
  ADD COLUMN IF NOT EXISTS last_prompt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS bot_states_last_prompt_at_idx
  ON public.bot_states (last_prompt_at)
  WHERE last_prompt_at IS NOT NULL;

-- Estatísticas de abandono no bot
CREATE TABLE IF NOT EXISTS public.bot_abandonment_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  flow_id UUID REFERENCES public.bot_flows(id) ON DELETE SET NULL,
  block_id TEXT,
  reason TEXT NOT NULL DEFAULT 'timeout',
  abandoned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bot_abandonment_stats TO authenticated;
GRANT ALL ON public.bot_abandonment_stats TO service_role;

ALTER TABLE public.bot_abandonment_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view abandonment stats of their workspace"
  ON public.bot_abandonment_stats
  FOR SELECT
  TO authenticated
  USING (public.is_member_of(workspace_id));

CREATE INDEX IF NOT EXISTS bot_abandonment_stats_ws_date_idx
  ON public.bot_abandonment_stats (workspace_id, abandoned_at DESC);