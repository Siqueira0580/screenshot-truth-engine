
-- Table to persist the master's current broadcast state for immediate viewer access
CREATE TABLE public.broadcast_sessions (
  id text PRIMARY KEY,
  master_id uuid NOT NULL,
  setlist_id text NOT NULL,
  current_song_index integer NOT NULL DEFAULT 0,
  scroll_top numeric NOT NULL DEFAULT 0,
  transpose integer NOT NULL DEFAULT 0,
  is_playing boolean NOT NULL DEFAULT false,
  speed numeric DEFAULT NULL,
  master_name text DEFAULT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.broadcast_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous viewers via link) can read broadcast sessions
CREATE POLICY "Anyone can read broadcast sessions"
  ON public.broadcast_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated masters can insert their own sessions
CREATE POLICY "Masters can insert own sessions"
  ON public.broadcast_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = master_id);

-- Masters can update their own sessions
CREATE POLICY "Masters can update own sessions"
  ON public.broadcast_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = master_id);

-- Masters can delete their own sessions
CREATE POLICY "Masters can delete own sessions"
  ON public.broadcast_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = master_id);
