
-- 1. Drop permissive public policies on setlists and setlist_items
DROP POLICY IF EXISTS "Public can read setlists by share token" ON setlists;
DROP POLICY IF EXISTS "Public can read items of shared setlists" ON setlist_items;

-- 2. Harden sync_invites guest update policy
DROP POLICY IF EXISTS "Guests can update invites by email" ON sync_invites;

CREATE POLICY "Guests can update invites by email"
ON sync_invites
FOR UPDATE
TO authenticated
USING (guest_email = (auth.jwt() ->> 'email'::text))
WITH CHECK (
  guest_email = (auth.jwt() ->> 'email'::text)
  AND status = 'accepted'
  AND master_id = (SELECT si.master_id FROM sync_invites si WHERE si.id = sync_invites.id)
  AND setlist_id = (SELECT si.setlist_id FROM sync_invites si WHERE si.id = sync_invites.id)
  AND token = (SELECT si.token FROM sync_invites si WHERE si.id = sync_invites.id)
  AND guest_email = (SELECT si.guest_email FROM sync_invites si WHERE si.id = sync_invites.id)
);
