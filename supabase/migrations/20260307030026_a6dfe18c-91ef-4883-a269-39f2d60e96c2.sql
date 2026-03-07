
CREATE TABLE public.ai_generated_chords (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chord_name text NOT NULL,
  instrument text NOT NULL DEFAULT 'guitar',
  chord_data jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (chord_name, instrument)
);

ALTER TABLE public.ai_generated_chords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ai_generated_chords"
  ON public.ai_generated_chords FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert ai_generated_chords"
  ON public.ai_generated_chords FOR INSERT
  WITH CHECK (true);
