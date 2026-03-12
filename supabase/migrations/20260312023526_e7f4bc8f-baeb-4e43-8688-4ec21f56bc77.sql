
-- 1. Remove the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can read all custom_chords" ON public.custom_chords;

-- 2. Recreate with tenant isolation (owner-only read)
CREATE POLICY "Users can read own custom_chords"
  ON public.custom_chords
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
