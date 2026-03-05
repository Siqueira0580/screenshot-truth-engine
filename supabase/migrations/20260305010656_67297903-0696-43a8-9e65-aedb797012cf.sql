-- Create a public storage bucket for artist photos
INSERT INTO storage.buckets (id, name, public) VALUES ('artist-photos', 'artist-photos', true);

-- Allow anyone to upload to the artist-photos bucket
CREATE POLICY "Anyone can upload artist photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'artist-photos');

-- Allow anyone to read artist photos
CREATE POLICY "Anyone can read artist photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'artist-photos');

-- Allow anyone to update artist photos
CREATE POLICY "Anyone can update artist photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'artist-photos');

-- Allow anyone to delete artist photos
CREATE POLICY "Anyone can delete artist photos"
ON storage.objects FOR DELETE
USING (bucket_id = 'artist-photos');