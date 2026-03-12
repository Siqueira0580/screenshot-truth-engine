
-- ============================================================
-- CORREÇÃO CRÍTICA: Fechar bucket audio-stems e aplicar RLS
-- ============================================================

-- 1. Tornar o bucket PRIVADO
UPDATE storage.buckets SET public = false WHERE id = 'audio-stems';

-- 2. Limpar TODAS as políticas anteriores do bucket
DROP POLICY IF EXISTS "Anyone can read audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can read audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can upload audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can update audio stems" ON storage.objects;
DROP POLICY IF EXISTS "Owner can delete audio stems" ON storage.objects;

-- 3. SELECT — utilizador autenticado só lê stems das suas próprias tracks
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

-- 4. INSERT — pode fazer upload se é dono da música OU já tem audio_track
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

-- 5. UPDATE — só o dono da track pode sobrescrever
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

-- 6. DELETE — só o dono da track pode apagar
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
