
DROP POLICY IF EXISTS "Masters can update own invites" ON sync_invites;

CREATE POLICY "Masters can update own invites"
ON sync_invites
FOR UPDATE
TO authenticated
USING (master_id = auth.uid())
WITH CHECK (
  master_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM setlists
    WHERE setlists.id = sync_invites.setlist_id
    AND setlists.user_id = auth.uid()
  )
);
