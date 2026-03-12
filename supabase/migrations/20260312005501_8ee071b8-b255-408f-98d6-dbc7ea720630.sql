
-- Drop existing broad storage policies
DROP POLICY IF EXISTS "Authenticated can upload audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload artist photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update artist photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete artist photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload sheet music" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update sheet music" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete sheet music" ON storage.objects;

-- audio-stems: owner must have an audio_track for that song_id (first folder segment)
CREATE POLICY "Owner can upload audio stems"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio-stems'
  AND (storage.foldername(name))[1] IN (
    SELECT song_id::text FROM public.audio_tracks WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Owner can update audio stems"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'audio-stems'
  AND (storage.foldername(name))[1] IN (
    SELECT song_id::text FROM public.audio_tracks WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Owner can delete audio stems"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audio-stems'
  AND (storage.foldername(name))[1] IN (
    SELECT song_id::text FROM public.audio_tracks WHERE user_id = auth.uid()
  )
);

-- artist-photos: owner is the artist creator (file name starts with artistId)
CREATE POLICY "Owner can upload artist photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'artist-photos'
  AND split_part(name, '.', 1) IN (
    SELECT id::text FROM public.artists WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Owner can update artist photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'artist-photos'
  AND split_part(name, '.', 1) IN (
    SELECT id::text FROM public.artists WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Owner can delete artist photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'artist-photos'
  AND split_part(name, '.', 1) IN (
    SELECT id::text FROM public.artists WHERE created_by = auth.uid()
  )
);

-- sheet_music: owner is the song creator (file name starts with songId)
CREATE POLICY "Owner can upload sheet music"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sheet_music'
  AND split_part(name, '.', 1) IN (
    SELECT id::text FROM public.songs WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Owner can update sheet music"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'sheet_music'
  AND split_part(name, '.', 1) IN (
    SELECT id::text FROM public.songs WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Owner can delete sheet music"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'sheet_music'
  AND split_part(name, '.', 1) IN (
    SELECT id::text FROM public.songs WHERE created_by = auth.uid()
  )
);
