-- Allow authenticated users to read any profile (needed for community feed, chat, etc.)
CREATE POLICY "Anyone authenticated can read profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Allow users to update is_read on messages they received
CREATE POLICY "Receiver can update is_read"
ON public.direct_messages
FOR UPDATE
TO authenticated
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);