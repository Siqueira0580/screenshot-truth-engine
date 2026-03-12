
-- =============================================
-- CORREÇÃO LGPD/GDPR: Tabela "profiles"
-- Adicionar política DELETE para "direito ao esquecimento"
-- =============================================

DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;

CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
