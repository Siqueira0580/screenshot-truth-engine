
-- 1. Add public_share_token column to setlists
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS public_share_token uuid DEFAULT NULL;

-- 2. Create index for fast token lookups
CREATE INDEX IF NOT EXISTS idx_setlists_public_share_token ON public.setlists (public_share_token) WHERE public_share_token IS NOT NULL;

-- 3. Drop the open public policies
DROP POLICY IF EXISTS "Public can read setlists by id" ON setlists;
DROP POLICY IF EXISTS "Public can read setlist_items" ON setlist_items;

-- 4. Token-gated public read for setlists (only rows with a valid token, matched via RPC)
CREATE POLICY "Public can read setlists by share token"
ON setlists FOR SELECT TO public
USING (public_share_token IS NOT NULL);

-- 5. Token-gated public read for setlist_items (only items belonging to shared setlists)
CREATE POLICY "Public can read items of shared setlists"
ON setlist_items FOR SELECT TO public
USING (
  EXISTS (
    SELECT 1 FROM setlists
    WHERE setlists.id = setlist_items.setlist_id
    AND setlists.public_share_token IS NOT NULL
  )
);
