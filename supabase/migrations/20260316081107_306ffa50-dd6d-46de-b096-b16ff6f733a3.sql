
-- 1. Add is_public column to setlists
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- 2. Drop existing SELECT policies for setlists
DROP POLICY IF EXISTS "Users can read own setlists" ON public.setlists;
DROP POLICY IF EXISTS "Guests can read invited setlists" ON public.setlists;

-- 3. Recreate SELECT policies: owner OR invited guests OR public
CREATE POLICY "Users can read own setlists"
  ON public.setlists FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Guests can read invited setlists"
  ON public.setlists FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sync_invites
      WHERE sync_invites.setlist_id = setlists.id
        AND sync_invites.guest_email = (auth.jwt() ->> 'email'::text)
        AND sync_invites.status = ANY (ARRAY['pending'::text, 'accepted'::text])
    )
  );

CREATE POLICY "Anyone can read public setlists"
  ON public.setlists FOR SELECT
  TO authenticated, anon
  USING (is_public = true);

-- 4. Also allow public read on setlist_items for public setlists
CREATE POLICY "Anyone can read public setlist items"
  ON public.setlist_items FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM setlists
      WHERE setlists.id = setlist_items.setlist_id
        AND setlists.is_public = true
    )
  );
