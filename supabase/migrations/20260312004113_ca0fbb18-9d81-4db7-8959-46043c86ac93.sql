
-- Drop existing composition_audio storage policies if they exist
DROP POLICY IF EXISTS "Users can upload own composition audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own composition audio" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own composition audio" ON storage.objects;

-- Make compositions_audio bucket private
UPDATE storage.buckets SET public = false WHERE id = 'compositions_audio';

-- Recreate storage policies scoped to owner
CREATE POLICY "Users can upload own composition audio"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'compositions_audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own composition audio"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'compositions_audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own composition audio"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'compositions_audio' AND (storage.foldername(name))[1] = auth.uid()::text);
