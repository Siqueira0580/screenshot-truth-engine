
-- Update policies to also allow pending invites (guest just clicked the link)
DROP POLICY IF EXISTS "Guests can read invited setlists" ON public.setlists;
DROP POLICY IF EXISTS "Guests can read invited setlist items" ON public.setlist_items;

CREATE POLICY "Guests can read invited setlists"
ON public.setlists
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sync_invites
    WHERE sync_invites.setlist_id = setlists.id
      AND sync_invites.guest_email = (auth.jwt() ->> 'email')
      AND sync_invites.status IN ('pending', 'accepted')
  )
);

CREATE POLICY "Guests can read invited setlist items"
ON public.setlist_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.sync_invites
    WHERE sync_invites.setlist_id = setlist_items.setlist_id
      AND sync_invites.guest_email = (auth.jwt() ->> 'email')
      AND sync_invites.status IN ('pending', 'accepted')
  )
);
