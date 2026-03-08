
CREATE TABLE public.composition_audios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  composition_id UUID NOT NULL REFERENCES public.compositions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  audio_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.composition_audios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own composition audios"
  ON public.composition_audios FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own composition audios"
  ON public.composition_audios FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own composition audios"
  ON public.composition_audios FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own composition audios"
  ON public.composition_audios FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
