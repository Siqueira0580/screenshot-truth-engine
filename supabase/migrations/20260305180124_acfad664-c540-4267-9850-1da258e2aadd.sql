ALTER TABLE public.profiles ADD COLUMN preferred_instrument text NOT NULL DEFAULT 'guitar';

-- Enable realtime for setlists table (for stage sync)
ALTER PUBLICATION supabase_realtime ADD TABLE public.setlists;