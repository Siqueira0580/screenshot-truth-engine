CREATE TABLE IF NOT EXISTS public.user_song_transpositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  semitones integer NOT NULL DEFAULT 0,
  transposed_key text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_ust_user ON public.user_song_transpositions(user_id);
CREATE INDEX IF NOT EXISTS idx_ust_song ON public.user_song_transpositions(song_id);

ALTER TABLE public.user_song_transpositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ust_select_own" ON public.user_song_transpositions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "ust_insert_own" ON public.user_song_transpositions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ust_update_own" ON public.user_song_transpositions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ust_delete_own" ON public.user_song_transpositions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER ust_set_updated_at
  BEFORE UPDATE ON public.user_song_transpositions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();