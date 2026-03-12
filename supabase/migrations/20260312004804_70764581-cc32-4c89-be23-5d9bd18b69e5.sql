
-- Add created_by column to songs and artists
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.artists ADD COLUMN IF NOT EXISTS created_by uuid;

-- Recreate UPDATE/DELETE policies scoped to creator
CREATE POLICY "Creator can update own songs"
ON public.songs FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Creator can delete own songs"
ON public.songs FOR DELETE TO authenticated
USING (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Creator can update own artists"
ON public.artists FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR created_by IS NULL);

CREATE POLICY "Creator can delete own artists"
ON public.artists FOR DELETE TO authenticated
USING (created_by = auth.uid() OR created_by IS NULL);
