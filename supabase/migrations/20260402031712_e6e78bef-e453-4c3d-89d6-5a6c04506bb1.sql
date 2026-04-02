
-- Drop restrictive update policies
DROP POLICY IF EXISTS "Creator can update own songs" ON public.songs;
DROP POLICY IF EXISTS "Admin ou Dono podem atualizar" ON public.songs;

-- Create collaborative update policy: any authenticated user can update
CREATE POLICY "Authenticated can update any song"
ON public.songs
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
