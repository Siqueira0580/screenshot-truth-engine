
ALTER TABLE public.songs ADD COLUMN IF NOT EXISTS pdf_url text DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public)
VALUES ('sheet_music', 'sheet_music', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload sheet music"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sheet_music');

CREATE POLICY "Anyone can read sheet music"
ON storage.objects FOR SELECT
USING (bucket_id = 'sheet_music');

CREATE POLICY "Anyone can delete sheet music"
ON storage.objects FOR DELETE
USING (bucket_id = 'sheet_music');
