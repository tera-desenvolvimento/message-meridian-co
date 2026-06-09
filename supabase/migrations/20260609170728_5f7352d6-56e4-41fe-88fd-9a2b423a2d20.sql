-- 1. Tabela de Fluxos do Bot
CREATE TABLE public.bot_flows (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    definition JSONB NOT NULL DEFAULT '{"blocks": [], "start_block": null}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Tabela de Estados do Bot por Conversa
CREATE TABLE public.bot_states (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES public.bot_flows(id) ON DELETE CASCADE,
    current_block_id TEXT,
    variables JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(conversation_id)
);

-- 3. Adicionar campos às tabelas existentes
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS default_bot_flow_id UUID REFERENCES public.bot_flows(id) ON DELETE SET NULL;

-- 4. Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_flows TO authenticated;
GRANT ALL ON public.bot_flows TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_states TO authenticated;
GRANT ALL ON public.bot_states TO service_role;

-- 5. RLS (Row Level Security)
ALTER TABLE public.bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bot_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage bot flows in their workspaces" ON public.bot_flows
    FOR ALL USING (
        workspace_id IN (
            SELECT workspace_id FROM public.memberships WHERE user_id = auth.uid()
        )
    ) WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM public.memberships WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can view bot states in their workspaces" ON public.bot_states
    FOR SELECT USING (
        conversation_id IN (
            SELECT id FROM public.conversations WHERE workspace_id IN (
                SELECT workspace_id FROM public.memberships WHERE user_id = auth.uid()
            )
        )
    );

-- Trigger para updated_at (Criando a função caso não exista)
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_bot_flows_updated_at BEFORE UPDATE ON public.bot_flows FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bot_states_updated_at BEFORE UPDATE ON public.bot_states FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();