
-- 1. Drop the vulnerable UPDATE policy
DROP POLICY IF EXISTS "Users can update own or shared compositions" ON compositions;

-- 2. Owner can update everything
CREATE POLICY "Owner can update own compositions"
ON compositions FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. Shared users can update content only (trigger blocks sensitive fields)
CREATE POLICY "Shared users can update shared compositions"
ON compositions FOR UPDATE TO authenticated
USING ((auth.jwt() ->> 'email'::text) = ANY(shared_with_emails))
WITH CHECK ((auth.jwt() ->> 'email'::text) = ANY(shared_with_emails));

-- 4. Replace trigger to block user_id AND shared_with_emails changes by non-owners
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

-- 5. Recreate trigger
DROP TRIGGER IF EXISTS tr_prevent_user_id_change ON compositions;
CREATE TRIGGER tr_prevent_user_id_change
BEFORE UPDATE ON compositions
FOR EACH ROW
EXECUTE FUNCTION prevent_user_id_change();
