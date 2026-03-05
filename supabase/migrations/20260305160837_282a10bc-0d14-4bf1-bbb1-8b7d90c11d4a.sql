
CREATE TABLE public.custom_chords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chord_name text NOT NULL,
  instrument text NOT NULL DEFAULT 'guitar',
  image_url text,
  frets integer[],
  user_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(chord_name, instrument, user_id)
);

ALTER TABLE public.custom_chords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all custom_chords"
  ON public.custom_chords FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own custom_chords"
  ON public.custom_chords FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own custom_chords"
  ON public.custom_chords FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own custom_chords"
  ON public.custom_chords FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
