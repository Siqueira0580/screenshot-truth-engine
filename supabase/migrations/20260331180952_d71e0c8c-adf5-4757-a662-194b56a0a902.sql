
-- 1. Create security definer functions to break RLS recursion

CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_group_members
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_group_creator(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_groups
    WHERE id = _group_id AND created_by = _user_id
  )
$$;

-- 2. Fix community_groups policies
DROP POLICY IF EXISTS "cg_select_member" ON public.community_groups;
DROP POLICY IF EXISTS "cg_select_creator" ON public.community_groups;
DROP POLICY IF EXISTS "cg_insert" ON public.community_groups;
DROP POLICY IF EXISTS "cg_update" ON public.community_groups;
DROP POLICY IF EXISTS "cg_delete" ON public.community_groups;

CREATE POLICY "cg_select" ON public.community_groups
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_group_member(auth.uid(), id)
);

CREATE POLICY "cg_insert" ON public.community_groups
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "cg_update" ON public.community_groups
FOR UPDATE TO authenticated
USING (created_by = auth.uid());

CREATE POLICY "cg_delete" ON public.community_groups
FOR DELETE TO authenticated
USING (created_by = auth.uid());

-- 3. Fix community_group_members policies
DROP POLICY IF EXISTS "cgm_select_creator" ON public.community_group_members;
DROP POLICY IF EXISTS "cgm_select_own" ON public.community_group_members;
DROP POLICY IF EXISTS "cgm_insert_creator" ON public.community_group_members;
DROP POLICY IF EXISTS "cgm_delete_creator" ON public.community_group_members;
DROP POLICY IF EXISTS "cgm_delete_self" ON public.community_group_members;

CREATE POLICY "cgm_select" ON public.community_group_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_group_creator(auth.uid(), group_id)
);

CREATE POLICY "cgm_insert" ON public.community_group_members
FOR INSERT TO authenticated
WITH CHECK (public.is_group_creator(auth.uid(), group_id) OR user_id = auth.uid());

CREATE POLICY "cgm_delete" ON public.community_group_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_group_creator(auth.uid(), group_id)
);

-- 4. Fix community_posts policies that reference group members
DROP POLICY IF EXISTS "cp_select_group_creator" ON public.community_posts;
DROP POLICY IF EXISTS "cp_select_group_member" ON public.community_posts;

CREATE POLICY "cp_select_group_member_or_creator" ON public.community_posts
FOR SELECT TO authenticated
USING (
  group_id IS NULL
  OR public.is_group_member(auth.uid(), group_id)
  OR public.is_group_creator(auth.uid(), group_id)
);
