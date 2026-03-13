
-- 1. Recreate the trigger function with full protection
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Operação não permitida: Não é possível transferir a autoria (user_id).';
  END IF;
  
  IF NEW.shared_with_emails IS DISTINCT FROM OLD.shared_with_emails THEN
    IF auth.uid() <> OLD.user_id THEN
      RAISE EXCEPTION 'Operação não permitida: Apenas o dono pode alterar a lista de colaboradores.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Ensure trigger is attached
DROP TRIGGER IF EXISTS tr_prevent_user_id_change ON compositions;
CREATE TRIGGER tr_prevent_user_id_change
  BEFORE UPDATE ON compositions
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_id_change();

-- 3. Replace the shared user UPDATE policy with one that explicitly blocks sensitive fields
DROP POLICY IF EXISTS "Shared users can update shared compositions" ON compositions;
CREATE POLICY "Shared users can update shared compositions"
ON compositions FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'email'::text) = ANY (shared_with_emails)
)
WITH CHECK (
  (auth.jwt() ->> 'email'::text) = ANY (shared_with_emails)
  AND user_id = (SELECT c.user_id FROM compositions c WHERE c.id = compositions.id)
  AND shared_with_emails IS NOT DISTINCT FROM (SELECT c.shared_with_emails FROM compositions c WHERE c.id = compositions.id)
);
