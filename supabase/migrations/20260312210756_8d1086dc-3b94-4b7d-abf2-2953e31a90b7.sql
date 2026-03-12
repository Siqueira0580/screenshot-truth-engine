
-- Fix upload policy: allow upload if user owns the song (created_by) or has it in their library
-- This handles the case where audio_tracks record doesn't exist yet at upload time
DROP POLICY IF EXISTS "Owner can upload audio stems" ON storage.objects;

CREATE POLICY "Owner can upload audio stems"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'audio-stems'
  AND (
    EXISTS (
      SELECT 1 FROM public.songs
      WHERE songs.created_by = auth.uid()
        AND songs.id::text = (storage.foldername(name))[1]
    )
    OR EXISTS (
      SELECT 1 FROM public.audio_tracks
      WHERE audio_tracks.user_id = auth.uid()
        AND audio_tracks.song_id::text = (storage.foldername(name))[1]
    )
  )
);
