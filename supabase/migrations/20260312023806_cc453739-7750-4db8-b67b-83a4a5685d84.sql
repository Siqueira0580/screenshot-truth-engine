
-- =============================================
-- CORREÇÃO: Tabela "artists"
-- Remover políticas permissivas duplicadas (INSERT, UPDATE, DELETE com true)
-- As políticas "Creator can ..." já existem para UPDATE e DELETE
-- =============================================

DROP POLICY IF EXISTS "Authenticated can delete artists" ON public.artists;
DROP POLICY IF EXISTS "Authenticated can insert artists" ON public.artists;
DROP POLICY IF EXISTS "Authenticated can update artists" ON public.artists;

-- INSERT: restringir ao dono (created_by)
CREATE POLICY "Authenticated can insert own artists"
  ON public.artists
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- =============================================
-- CORREÇÃO: Tabela "songs"
-- Remover políticas permissivas duplicadas (INSERT, UPDATE, DELETE com true)
-- As políticas "Creator can ..." já existem para UPDATE e DELETE
-- =============================================

DROP POLICY IF EXISTS "Authenticated can delete songs" ON public.songs;
DROP POLICY IF EXISTS "Authenticated can insert songs" ON public.songs;
DROP POLICY IF EXISTS "Authenticated can update songs" ON public.songs;

-- INSERT: restringir ao dono (created_by)
CREATE POLICY "Authenticated can insert own songs"
  ON public.songs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
