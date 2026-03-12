
-- =====================================================
-- Fix: Restrict songs table write policies to authenticated
-- =====================================================

-- DROP existing public-role policies
DROP POLICY IF EXISTS "Anyone can insert songs" ON public.songs;
DROP POLICY IF EXISTS "Anyone can update songs" ON public.songs;
DROP POLICY IF EXISTS "Anyone can delete songs" ON public.songs;

-- Recreate with TO authenticated
CREATE POLICY "Authenticated can insert songs"
ON public.songs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update songs"
ON public.songs FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete songs"
ON public.songs FOR DELETE TO authenticated
USING (true);

-- =====================================================
-- Fix: Restrict artists table write policies to authenticated
-- =====================================================

DROP POLICY IF EXISTS "Anyone can insert artists" ON public.artists;
DROP POLICY IF EXISTS "Anyone can update artists" ON public.artists;
DROP POLICY IF EXISTS "Anyone can delete artists" ON public.artists;

CREATE POLICY "Authenticated can insert artists"
ON public.artists FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update artists"
ON public.artists FOR UPDATE TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete artists"
ON public.artists FOR DELETE TO authenticated
USING (true);
