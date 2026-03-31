
-- Fix broken RLS policy: cg_select_member references cgm.id instead of community_groups.id
DROP POLICY IF EXISTS "cg_select_member" ON public.community_groups;

CREATE POLICY "cg_select_member"
ON public.community_groups
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM community_group_members cgm
    WHERE cgm.group_id = community_groups.id
      AND cgm.user_id = auth.uid()
  )
);
