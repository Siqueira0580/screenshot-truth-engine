
-- Add user_id to setlists (nullable initially for existing data)
ALTER TABLE public.setlists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add user_id to audio_tracks (nullable initially for existing data)
ALTER TABLE public.audio_tracks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create profiles table for storing user display info
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles RLS: users can read/update their own profile
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Drop old permissive policies on setlists (replace with user-scoped)
DROP POLICY IF EXISTS "Anyone can read setlists" ON public.setlists;
DROP POLICY IF EXISTS "Anyone can insert setlists" ON public.setlists;
DROP POLICY IF EXISTS "Anyone can update setlists" ON public.setlists;
DROP POLICY IF EXISTS "Anyone can delete setlists" ON public.setlists;

-- Setlists: user-scoped RLS
CREATE POLICY "Users can read own setlists" ON public.setlists FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own setlists" ON public.setlists FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own setlists" ON public.setlists FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own setlists" ON public.setlists FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Drop old permissive policies on audio_tracks (replace with user-scoped)
DROP POLICY IF EXISTS "Anyone can read audio_tracks" ON public.audio_tracks;
DROP POLICY IF EXISTS "Anyone can insert audio_tracks" ON public.audio_tracks;
DROP POLICY IF EXISTS "Anyone can update audio_tracks" ON public.audio_tracks;
DROP POLICY IF EXISTS "Anyone can delete audio_tracks" ON public.audio_tracks;

-- Audio tracks: user-scoped RLS
CREATE POLICY "Users can read own audio_tracks" ON public.audio_tracks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own audio_tracks" ON public.audio_tracks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own audio_tracks" ON public.audio_tracks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own audio_tracks" ON public.audio_tracks FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Setlist items: user-scoped through setlist ownership
DROP POLICY IF EXISTS "Anyone can read setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Anyone can insert setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Anyone can update setlist_items" ON public.setlist_items;
DROP POLICY IF EXISTS "Anyone can delete setlist_items" ON public.setlist_items;

CREATE POLICY "Users can read own setlist_items" ON public.setlist_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.setlists WHERE id = setlist_items.setlist_id AND user_id = auth.uid()));
CREATE POLICY "Users can insert own setlist_items" ON public.setlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.setlists WHERE id = setlist_items.setlist_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own setlist_items" ON public.setlist_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.setlists WHERE id = setlist_items.setlist_id AND user_id = auth.uid()));
CREATE POLICY "Users can delete own setlist_items" ON public.setlist_items FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.setlists WHERE id = setlist_items.setlist_id AND user_id = auth.uid()));

-- Songs & Artists stay PUBLIC (no changes needed, existing policies allow anyone)
