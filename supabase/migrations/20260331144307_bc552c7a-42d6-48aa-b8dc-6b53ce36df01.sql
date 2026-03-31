
-- Step 1: Create community_groups
CREATE TABLE public.community_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.community_groups ENABLE ROW LEVEL SECURITY;

-- Step 2: Create community_group_members
CREATE TABLE public.community_group_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);
ALTER TABLE public.community_group_members ENABLE ROW LEVEL SECURITY;

-- Step 3: RLS for community_groups
CREATE POLICY "cg_select_creator" ON public.community_groups FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY "cg_select_member" ON public.community_groups FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.community_group_members cgm WHERE cgm.group_id = id AND cgm.user_id = auth.uid()));
CREATE POLICY "cg_insert" ON public.community_groups FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "cg_update" ON public.community_groups FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "cg_delete" ON public.community_groups FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Step 4: RLS for community_group_members
CREATE POLICY "cgm_select_own" ON public.community_group_members FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cgm_select_creator" ON public.community_group_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.community_groups cg WHERE cg.id = group_id AND cg.created_by = auth.uid()));
CREATE POLICY "cgm_insert_creator" ON public.community_group_members FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.community_groups cg WHERE cg.id = group_id AND cg.created_by = auth.uid()));
CREATE POLICY "cgm_delete_creator" ON public.community_group_members FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.community_groups cg WHERE cg.id = group_id AND cg.created_by = auth.uid()));
CREATE POLICY "cgm_delete_self" ON public.community_group_members FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Step 5: Add group_id to community_posts
ALTER TABLE public.community_posts ADD COLUMN group_id UUID REFERENCES public.community_groups(id) ON DELETE CASCADE DEFAULT NULL;

-- Step 6: RLS for group posts on community_posts
CREATE POLICY "cp_select_group_member" ON public.community_posts FOR SELECT TO authenticated USING (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.community_group_members cgm WHERE cgm.group_id = community_posts.group_id AND cgm.user_id = auth.uid()));
CREATE POLICY "cp_select_group_creator" ON public.community_posts FOR SELECT TO authenticated USING (group_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.community_groups cg WHERE cg.id = community_posts.group_id AND cg.created_by = auth.uid()));
