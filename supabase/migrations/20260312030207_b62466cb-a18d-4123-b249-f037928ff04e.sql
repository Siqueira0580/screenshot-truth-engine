
-- =============================================
-- CORREÇÃO CRÍTICA: Tabela "sync_invites"
-- IDOR / Escalonamento de Privilégios
-- =============================================

-- 1. Column-Level Security: Revogar UPDATE geral e conceder apenas em colunas seguras
REVOKE UPDATE ON public.sync_invites FROM authenticated;
GRANT UPDATE (status, accepted_at) ON public.sync_invites TO authenticated;

-- 2. Reforço na política INSERT: Verificar que o master é dono da setlist
DROP POLICY IF EXISTS "Masters can insert invites" ON public.sync_invites;
CREATE POLICY "Masters can insert invites"
  ON public.sync_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    master_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.setlists
      WHERE id = setlist_id
        AND user_id = auth.uid()
    )
  );
