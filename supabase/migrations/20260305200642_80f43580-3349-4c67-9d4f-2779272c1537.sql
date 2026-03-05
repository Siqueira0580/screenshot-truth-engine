-- Drop problematic policies that reference auth.users
DROP POLICY IF EXISTS "Guests can read invites by email" ON public.sync_invites;
DROP POLICY IF EXISTS "Guests can update invites by email" ON public.sync_invites;

-- Recreate using auth.jwt() instead of subquery on auth.users
CREATE POLICY "Guests can read invites by email"
ON public.sync_invites
FOR SELECT
TO authenticated
USING (guest_email = (auth.jwt() ->> 'email'));

CREATE POLICY "Guests can update invites by email"
ON public.sync_invites
FOR UPDATE
TO authenticated
USING (guest_email = (auth.jwt() ->> 'email'));