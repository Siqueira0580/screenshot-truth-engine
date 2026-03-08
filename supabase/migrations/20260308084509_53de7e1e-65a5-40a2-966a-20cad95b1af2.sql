
-- Add shared_with_emails column to compositions
ALTER TABLE public.compositions ADD COLUMN IF NOT EXISTS shared_with_emails text[] DEFAULT '{}';

-- Drop existing RLS policies on compositions to recreate with collaboration logic
DROP POLICY IF EXISTS "Users can read own compositions" ON public.compositions;
DROP POLICY IF EXISTS "Users can update own compositions" ON public.compositions;

-- New SELECT: owner OR email in shared_with_emails
CREATE POLICY "Users can read own or shared compositions"
  ON public.compositions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = ANY(shared_with_emails)
  );

-- New UPDATE: owner OR collaborator
CREATE POLICY "Users can update own or shared compositions"
  ON public.compositions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR (auth.jwt() ->> 'email') = ANY(shared_with_emails)
  );
