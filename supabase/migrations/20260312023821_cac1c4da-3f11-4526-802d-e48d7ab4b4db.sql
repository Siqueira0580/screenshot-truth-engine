
-- =============================================
-- CORREÇÃO: Tabelas "artists" e "songs"
-- As políticas "Creator can ..." permitem created_by IS NULL,
-- o que efetivamente dá acesso a qualquer utilizador autenticado
-- sobre registos sem dono. Restringir estritamente.
-- =============================================

-- artists: UPDATE
DROP POLICY IF EXISTS "Creator can update own artists" ON public.artists;
CREATE POLICY "Creator can update own artists"
  ON public.artists
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- artists: DELETE
DROP POLICY IF EXISTS "Creator can delete own artists" ON public.artists;
CREATE POLICY "Creator can delete own artists"
  ON public.artists
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- songs: UPDATE
DROP POLICY IF EXISTS "Creator can update own songs" ON public.songs;
CREATE POLICY "Creator can update own songs"
  ON public.songs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- songs: DELETE
DROP POLICY IF EXISTS "Creator can delete own songs" ON public.songs;
CREATE POLICY "Creator can delete own songs"
  ON public.songs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
