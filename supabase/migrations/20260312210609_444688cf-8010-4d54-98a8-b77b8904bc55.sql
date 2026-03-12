
-- Drop any existing policies for audio-stems
DROP POLICY IF EXISTS "Owner can upload audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can read audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read audio stems" ON storage.objects;

-- Recreate owner-scoped policies
CREATE POLICY "Owner can read audio stems"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'audio-stems'
  AND EXISTS (
    SELECT 1 FROM public.audio_tracks
    WHERE audio_tracks.user_id = auth.uid()
      AND audio_tracks.song_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Owner can upload audio stems"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio-stems'
  AND EXISTS (
    SELECT 1 FROM public.audio_tracks
    WHERE audio_tracks.user_id = auth.uid()
      AND audio_tracks.song_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Owner can update audio stems"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'audio-stems'
  AND EXISTS (
    SELECT 1 FROM public.audio_tracks
    WHERE audio_tracks.user_id = auth.uid()
      AND audio_tracks.song_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Owner can delete audio stems"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'audio-stems'
  AND EXISTS (
    SELECT 1 FROM public.audio_tracks
    WHERE audio_tracks.user_id = auth.uid()
      AND audio_tracks.song_id::text = (storage.foldername(name))[1]
  )
);
