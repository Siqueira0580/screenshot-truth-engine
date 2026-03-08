
-- 1. Create user_library junction table
CREATE TABLE public.user_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  song_id uuid NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  added_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, song_id)
);

-- 2. Enable RLS
ALTER TABLE public.user_library ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies - users can only manage their own library
CREATE POLICY "Users can read own library" ON public.user_library
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own library" ON public.user_library
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own library" ON public.user_library
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. Add library_setup_completed to profiles
ALTER TABLE public.profiles ADD COLUMN library_setup_completed boolean NOT NULL DEFAULT false;

-- 5. Index for fast lookups
CREATE INDEX idx_user_library_user_id ON public.user_library(user_id);
CREATE INDEX idx_user_library_song_id ON public.user_library(song_id);
