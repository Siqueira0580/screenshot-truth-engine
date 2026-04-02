
-- Add expires_at column with default 7 days from now
ALTER TABLE public.group_invites
ADD COLUMN expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days');

-- Backfill existing invites
UPDATE public.group_invites
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NOT NULL;

-- Update the UPDATE policy to also check expiration
DROP POLICY IF EXISTS "Authenticated can update invite status" ON public.group_invites;
CREATE POLICY "Authenticated can update invite status"
ON public.group_invites
FOR UPDATE
TO authenticated
USING (status = 'pending' AND expires_at > now())
WITH CHECK (status = ANY (ARRAY['accepted'::text, 'rejected'::text]));
