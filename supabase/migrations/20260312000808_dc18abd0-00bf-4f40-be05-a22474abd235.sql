
-- Drop existing public-role policies for INSERT and DELETE
DROP POLICY IF EXISTS "Users can insert own compositions" ON public.compositions;
DROP POLICY IF EXISTS "Users can delete own compositions" ON public.compositions;

-- Recreate INSERT policy with authenticated role
CREATE POLICY "Users can insert own compositions"
ON public.compositions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Recreate DELETE policy with authenticated role
CREATE POLICY "Users can delete own compositions"
ON public.compositions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
