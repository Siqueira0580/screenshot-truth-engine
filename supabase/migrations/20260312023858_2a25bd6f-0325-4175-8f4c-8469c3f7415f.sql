
-- =============================================
-- CORREÇÃO: Tabela "ai_generated_chords"
-- Substituir WITH CHECK (true) por expressão não-trivial
-- que garante que o utilizador está autenticado
-- =============================================

DROP POLICY IF EXISTS "Authenticated can insert ai_generated_chords" ON public.ai_generated_chords;

CREATE POLICY "Authenticated can insert ai_generated_chords"
  ON public.ai_generated_chords
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
