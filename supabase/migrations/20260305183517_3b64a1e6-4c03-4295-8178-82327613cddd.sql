
-- Broadcast groups table: saves reusable email lists
CREATE TABLE public.broadcast_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own broadcast_groups" ON public.broadcast_groups FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own broadcast_groups" ON public.broadcast_groups FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own broadcast_groups" ON public.broadcast_groups FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own broadcast_groups" ON public.broadcast_groups FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Broadcast group members table
CREATE TABLE public.broadcast_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.broadcast_groups(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (group_id, email)
);

ALTER TABLE public.broadcast_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own group members" ON public.broadcast_group_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.broadcast_groups WHERE broadcast_groups.id = broadcast_group_members.group_id AND broadcast_groups.user_id = auth.uid()));
CREATE POLICY "Users can insert own group members" ON public.broadcast_group_members FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.broadcast_groups WHERE broadcast_groups.id = broadcast_group_members.group_id AND broadcast_groups.user_id = auth.uid()));
CREATE POLICY "Users can update own group members" ON public.broadcast_group_members FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.broadcast_groups WHERE broadcast_groups.id = broadcast_group_members.group_id AND broadcast_groups.user_id = auth.uid()));
CREATE POLICY "Users can delete own group members" ON public.broadcast_group_members FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.broadcast_groups WHERE broadcast_groups.id = broadcast_group_members.group_id AND broadcast_groups.user_id = auth.uid()));
