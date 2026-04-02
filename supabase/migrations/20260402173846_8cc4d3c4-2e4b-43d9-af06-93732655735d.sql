
CREATE TABLE public.song_edits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  summary TEXT NOT NULL DEFAULT 'Editou a cifra',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.song_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read song edits"
ON public.song_edits FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert own edits"
ON public.song_edits FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete edits"
ON public.song_edits FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_song_edits_song_id ON public.song_edits(song_id);
CREATE INDEX idx_song_edits_created_at ON public.song_edits(created_at DESC);
