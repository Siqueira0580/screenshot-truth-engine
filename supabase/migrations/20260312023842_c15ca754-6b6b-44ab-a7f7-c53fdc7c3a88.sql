
-- =============================================
-- CORREÇÃO: Tabela "ai_generated_chords"
-- INSERT aberto ao public com WITH CHECK (true)
-- Restringir a utilizadores autenticados apenas
-- =============================================

DROP POLICY IF EXISTS "Anyone can insert ai_generated_chords" ON public.ai_generated_chords;

CREATE POLICY "Authenticated can insert ai_generated_chords"
  ON public.ai_generated_chords
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
