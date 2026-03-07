
CREATE TABLE public.compositions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body_text TEXT DEFAULT '',
  musical_key TEXT DEFAULT 'Am',
  bpm INTEGER DEFAULT 120,
  style TEXT DEFAULT 'Bossa Nova',
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.compositions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own compositions" ON public.compositions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own compositions" ON public.compositions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own compositions" ON public.compositions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own compositions" ON public.compositions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_compositions_updated_at
  BEFORE UPDATE ON public.compositions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
