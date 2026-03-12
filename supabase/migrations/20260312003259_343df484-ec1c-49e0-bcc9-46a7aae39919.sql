
-- =====================================================
-- Fix: Secure storage bucket write policies
-- Restrict INSERT/UPDATE/DELETE to authenticated role
-- =====================================================

-- audio-stems bucket
DROP POLICY IF EXISTS "Anyone can upload audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update audio stems" ON storage.objects;

CREATE POLICY "Authenticated can upload audio stems"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'audio-stems');

CREATE POLICY "Authenticated can update audio stems"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'audio-stems');

CREATE POLICY "Authenticated can delete audio stems"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'audio-stems');

-- artist-photos bucket
DROP POLICY IF EXISTS "Anyone can upload artist photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete artist photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update artist photos" ON storage.objects;

CREATE POLICY "Authenticated can upload artist photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'artist-photos');

CREATE POLICY "Authenticated can update artist photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'artist-photos');

CREATE POLICY "Authenticated can delete artist photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'artist-photos');

-- sheet_music bucket
DROP POLICY IF EXISTS "Anyone can upload sheet music" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete sheet music" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update sheet music" ON storage.objects;

CREATE POLICY "Authenticated can upload sheet music"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sheet_music');

CREATE POLICY "Authenticated can update sheet music"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'sheet_music');

CREATE POLICY "Authenticated can delete sheet music"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sheet_music');
