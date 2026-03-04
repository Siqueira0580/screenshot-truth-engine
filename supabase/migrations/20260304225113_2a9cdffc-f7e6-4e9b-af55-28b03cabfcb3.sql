
-- Create artists table
CREATE TABLE public.artists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    photo_url TEXT,
    about TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create songs table
CREATE TABLE public.songs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    artist TEXT,
    composer TEXT,
    musical_key TEXT,
    style TEXT,
    body_text TEXT,
    default_speed INTEGER DEFAULT 250,
    loop_count INTEGER DEFAULT 0,
    auto_next BOOLEAN DEFAULT true,
    youtube_url TEXT,
    bpm INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create setlists table
CREATE TABLE public.setlists (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    show_date TIMESTAMP WITH TIME ZONE,
    show_duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create setlist_items table
CREATE TABLE public.setlist_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
    song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    loop_count INTEGER,
    speed INTEGER,
    bpm INTEGER
);

-- Enable RLS on all tables
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_items ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth required for this app initially)
CREATE POLICY "Anyone can read artists" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Anyone can insert artists" ON public.artists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update artists" ON public.artists FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete artists" ON public.artists FOR DELETE USING (true);

CREATE POLICY "Anyone can read songs" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Anyone can insert songs" ON public.songs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update songs" ON public.songs FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete songs" ON public.songs FOR DELETE USING (true);

CREATE POLICY "Anyone can read setlists" ON public.setlists FOR SELECT USING (true);
CREATE POLICY "Anyone can insert setlists" ON public.setlists FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update setlists" ON public.setlists FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete setlists" ON public.setlists FOR DELETE USING (true);

CREATE POLICY "Anyone can read setlist_items" ON public.setlist_items FOR SELECT USING (true);
CREATE POLICY "Anyone can insert setlist_items" ON public.setlist_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update setlist_items" ON public.setlist_items FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete setlist_items" ON public.setlist_items FOR DELETE USING (true);

-- Index for setlist items ordering
CREATE INDEX idx_setlist_items_position ON public.setlist_items(setlist_id, position);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for songs updated_at
CREATE TRIGGER update_songs_updated_at
    BEFORE UPDATE ON public.songs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
