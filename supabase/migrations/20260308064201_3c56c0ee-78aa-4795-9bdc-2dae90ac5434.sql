
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS wizard_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS favorite_styles text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS favorite_artists jsonb DEFAULT '[]'::jsonb;
