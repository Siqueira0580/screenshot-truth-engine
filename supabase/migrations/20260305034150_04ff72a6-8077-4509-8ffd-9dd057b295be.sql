
-- Create audio_tracks table for stem files
CREATE TABLE public.audio_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID REFERENCES public.songs(id) ON DELETE CASCADE NOT NULL,
  file_full TEXT,
  file_vocals TEXT,
  file_percussion TEXT,
  file_harmony TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audio_tracks ENABLE ROW LEVEL SECURITY;

-- RLS policies (public access like other tables)
CREATE POLICY "Anyone can read audio_tracks" ON public.audio_tracks FOR SELECT USING (true);
CREATE POLICY "Anyone can insert audio_tracks" ON public.audio_tracks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update audio_tracks" ON public.audio_tracks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete audio_tracks" ON public.audio_tracks FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_audio_tracks_updated_at
  BEFORE UPDATE ON public.audio_tracks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for audio stems
INSERT INTO storage.buckets (id, name, public) VALUES ('audio-stems', 'audio-stems', true);

-- Storage RLS policies
CREATE POLICY "Anyone can upload audio stems" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-stems');
CREATE POLICY "Anyone can read audio stems" ON storage.objects FOR SELECT USING (bucket_id = 'audio-stems');
CREATE POLICY "Anyone can update audio stems" ON storage.objects FOR UPDATE USING (bucket_id = 'audio-stems');
CREATE POLICY "Anyone can delete audio stems" ON storage.objects FOR DELETE USING (bucket_id = 'audio-stems');
