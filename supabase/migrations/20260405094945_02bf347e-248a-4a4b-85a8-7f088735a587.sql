
-- Group admins can read setlists posted in their groups
CREATE POLICY "Group admins can read group setlists"
ON public.setlists
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_posts cp
    JOIN community_group_members cgm ON cgm.group_id = cp.group_id
    WHERE cp.setlist_id = setlists.id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
      AND cgm.status = 'active'
  )
);

-- Group admins can update setlists posted in their groups
CREATE POLICY "Group admins can update group setlists"
ON public.setlists
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_posts cp
    JOIN community_group_members cgm ON cgm.group_id = cp.group_id
    WHERE cp.setlist_id = setlists.id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
      AND cgm.status = 'active'
  )
);

-- Group admins can read setlist items of group setlists
CREATE POLICY "Group admins can read group setlist items"
ON public.setlist_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_posts cp
    JOIN community_group_members cgm ON cgm.group_id = cp.group_id
    WHERE cp.setlist_id = setlist_items.setlist_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
      AND cgm.status = 'active'
  )
);

-- Group admins can insert items into group setlists
CREATE POLICY "Group admins can insert group setlist items"
ON public.setlist_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM community_posts cp
    JOIN community_group_members cgm ON cgm.group_id = cp.group_id
    WHERE cp.setlist_id = setlist_items.setlist_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
      AND cgm.status = 'active'
  )
);

-- Group admins can update items in group setlists
CREATE POLICY "Group admins can update group setlist items"
ON public.setlist_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_posts cp
    JOIN community_group_members cgm ON cgm.group_id = cp.group_id
    WHERE cp.setlist_id = setlist_items.setlist_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
      AND cgm.status = 'active'
  )
);

-- Group admins can delete items from group setlists
CREATE POLICY "Group admins can delete group setlist items"
ON public.setlist_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM community_posts cp
    JOIN community_group_members cgm ON cgm.group_id = cp.group_id
    WHERE cp.setlist_id = setlist_items.setlist_id
      AND cgm.user_id = auth.uid()
      AND cgm.role = 'admin'
      AND cgm.status = 'active'
  )
);
