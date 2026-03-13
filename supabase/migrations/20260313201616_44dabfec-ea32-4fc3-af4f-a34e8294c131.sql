
-- 1. Remove the old vulnerable policy (public role, weak WITH CHECK)
DROP POLICY IF EXISTS "Os usuários podem atualizar composições próprias ou compart" ON compositions;

-- 2. Remove the other UPDATE policy to avoid duplicates
DROP POLICY IF EXISTS "Users can update own or shared compositions" ON compositions;

-- 3. Create the single, hardened UPDATE policy
CREATE POLICY "Users can update own or shared compositions"
ON compositions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id OR (auth.jwt() ->> 'email'::text) = ANY(shared_with_emails)
)
WITH CHECK (
  auth.uid() = user_id OR (auth.jwt() ->> 'email'::text) = ANY(shared_with_emails)
);

-- 4. Add trigger to prevent user_id changes (function already exists)
DROP TRIGGER IF EXISTS tr_prevent_user_id_change ON compositions;
CREATE TRIGGER tr_prevent_user_id_change
BEFORE UPDATE ON compositions
FOR EACH ROW
EXECUTE FUNCTION prevent_user_id_change();
