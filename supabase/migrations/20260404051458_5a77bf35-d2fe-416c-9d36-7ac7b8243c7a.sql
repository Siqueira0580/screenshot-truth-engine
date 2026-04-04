
-- Add role and status columns
ALTER TABLE public.community_group_members
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

-- Backfill: set creators as admin
UPDATE public.community_group_members cgm
SET role = 'admin'
FROM public.community_groups cg
WHERE cgm.group_id = cg.id AND cgm.user_id = cg.created_by;

-- Create a security definer function to check if user is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_group_members
    WHERE user_id = _user_id AND group_id = _group_id AND role = 'admin' AND status = 'active'
  )
$$;

-- Drop existing policies that need updating
DROP POLICY IF EXISTS "cgm_select" ON public.community_group_members;
DROP POLICY IF EXISTS "cgm_insert" ON public.community_group_members;
DROP POLICY IF EXISTS "cgm_delete" ON public.community_group_members;

-- Recreate SELECT: members can see other members of their groups, but only if they are active
CREATE POLICY "cgm_select" ON public.community_group_members
FOR SELECT TO authenticated
USING (
  is_group_creator(auth.uid(), group_id)
  OR is_group_admin(auth.uid(), group_id)
  OR (user_id = auth.uid() AND status = 'active')
);

-- Recreate INSERT: group creator or group admin can add members
CREATE POLICY "cgm_insert" ON public.community_group_members
FOR INSERT TO authenticated
WITH CHECK (
  is_group_creator(auth.uid(), group_id)
  OR is_group_admin(auth.uid(), group_id)
  OR (user_id = auth.uid())
);

-- Recreate DELETE: group admin/creator can remove, or user can remove self
CREATE POLICY "cgm_delete" ON public.community_group_members
FOR DELETE TO authenticated
USING (
  (user_id = auth.uid())
  OR is_group_creator(auth.uid(), group_id)
  OR is_group_admin(auth.uid(), group_id)
);

-- Add UPDATE policy: group admin/creator can update member role/status
CREATE POLICY "cgm_update" ON public.community_group_members
FOR UPDATE TO authenticated
USING (
  is_group_creator(auth.uid(), group_id)
  OR is_group_admin(auth.uid(), group_id)
)
WITH CHECK (
  is_group_creator(auth.uid(), group_id)
  OR is_group_admin(auth.uid(), group_id)
);

-- Update community_groups SELECT to exclude blocked members
DROP POLICY IF EXISTS "cg_select" ON public.community_groups;
CREATE POLICY "cg_select" ON public.community_groups
FOR SELECT TO authenticated
USING (
  (created_by = auth.uid())
  OR is_group_member(auth.uid(), id)
);

-- Update community_posts SELECT for group posts: blocked users can't see
DROP POLICY IF EXISTS "cp_select_group_member_or_creator" ON public.community_posts;
CREATE POLICY "cp_select_group_member_or_creator" ON public.community_posts
FOR SELECT TO authenticated
USING (
  (group_id IS NULL)
  OR is_group_creator(auth.uid(), group_id)
  OR (is_group_member(auth.uid(), group_id) AND EXISTS (
    SELECT 1 FROM public.community_group_members
    WHERE user_id = auth.uid() AND community_group_members.group_id = community_posts.group_id AND status = 'active'
  ))
);
