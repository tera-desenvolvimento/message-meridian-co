
-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.user_role AS ENUM ('ADMIN', 'AGENT');
CREATE TYPE public.conversation_status AS ENUM ('OPEN', 'PENDING', 'CLOSED');
CREATE TYPE public.conversation_type AS ENUM ('PRIVATE', 'GROUP');

-- =========================================
-- TABLES
-- =========================================
CREATE TABLE public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role public.user_role NOT NULL DEFAULT 'AGENT',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id)
);

CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type public.conversation_type NOT NULL DEFAULT 'PRIVATE',
  name text NOT NULL,
  last_message text NOT NULL DEFAULT '',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  status public.conversation_status NOT NULL DEFAULT 'OPEN',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_workspace_idx ON public.conversations(workspace_id, last_message_at DESC);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  content text NOT NULL,
  from_me boolean NOT NULL DEFAULT false,
  sender_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages(conversation_id, created_at);

-- =========================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion)
-- =========================================
CREATE OR REPLACE FUNCTION public.is_member_of(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE workspace_id = _workspace_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_of(_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE workspace_id = _workspace_id AND user_id = auth.uid() AND role = 'ADMIN'
  );
$$;

-- Returns the current user's primary workspace (first one)
CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT workspace_id FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- True if I share at least one workspace with this user
CREATE OR REPLACE FUNCTION public.shares_workspace_with(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships m1
    JOIN public.memberships m2 ON m1.workspace_id = m2.workspace_id
    WHERE m1.user_id = auth.uid() AND m2.user_id = _user_id
  );
$$;

-- =========================================
-- ENABLE RLS
-- =========================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =========================================
-- POLICIES: workspaces
-- =========================================
CREATE POLICY "Members can view their workspaces"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_member_of(id));

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can update their workspace"
  ON public.workspaces FOR UPDATE TO authenticated
  USING (public.is_admin_of(id))
  WITH CHECK (public.is_admin_of(id));

-- =========================================
-- POLICIES: profiles
-- =========================================
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can view profiles of workspace mates"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.shares_workspace_with(id));

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- =========================================
-- POLICIES: memberships
-- =========================================
CREATE POLICY "Users can view memberships of their workspaces"
  ON public.memberships FOR SELECT TO authenticated
  USING (public.is_member_of(workspace_id));

-- Users can insert their own membership when creating a workspace,
-- or admins can add members to their workspace.
CREATE POLICY "Self bootstrap or admin invite"
  ON public.memberships FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin_of(workspace_id)
  );

CREATE POLICY "Admins can update memberships"
  ON public.memberships FOR UPDATE TO authenticated
  USING (public.is_admin_of(workspace_id))
  WITH CHECK (public.is_admin_of(workspace_id));

CREATE POLICY "Admins can remove members"
  ON public.memberships FOR DELETE TO authenticated
  USING (public.is_admin_of(workspace_id));

-- =========================================
-- POLICIES: conversations
-- =========================================
CREATE POLICY "Members can view workspace conversations"
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_member_of(workspace_id));

CREATE POLICY "Members can create workspace conversations"
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (public.is_member_of(workspace_id));

CREATE POLICY "Members can update workspace conversations"
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_member_of(workspace_id))
  WITH CHECK (public.is_member_of(workspace_id));

CREATE POLICY "Admins can delete workspace conversations"
  ON public.conversations FOR DELETE TO authenticated
  USING (public.is_admin_of(workspace_id));

-- =========================================
-- POLICIES: messages
-- =========================================
CREATE POLICY "Members can view messages in their workspace"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.is_member_of(c.workspace_id)
    )
  );

CREATE POLICY "Members can send messages in their workspace"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND public.is_member_of(c.workspace_id)
    )
  );

-- =========================================
-- TRIGGER: auto-create profile on signup
-- =========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- TRIGGER: update conversation last_message on new message
-- =========================================
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message = NEW.content,
      last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_inserted
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- =========================================
-- REALTIME
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
