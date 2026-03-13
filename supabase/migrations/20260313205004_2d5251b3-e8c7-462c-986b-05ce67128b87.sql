
-- 1. Make audio-stems bucket private
UPDATE storage.buckets SET public = false WHERE id = 'audio-stems';

-- 2. Drop old open read policies
DROP POLICY IF EXISTS "Anyone can read audio stems" ON storage.objects;

-- 3. Drop and recreate owner-scoped read policy
DROP POLICY IF EXISTS "Owner can read audio stems" ON storage.objects;
CREATE POLICY "Owner can read audio stems"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audio-stems'
  AND (storage.foldername(name))[1] IN (
    SELECT song_id::text FROM public.audio_tracks WHERE user_id = auth.uid()
  )
);

-- 4. Drop stale public policies
DROP POLICY IF EXISTS "Public can read setlist_items" ON setlist_items;
DROP POLICY IF EXISTS "Public can read setlists by id" ON setlists;
