
-- Add image_url column to community_posts
ALTER TABLE public.community_posts ADD COLUMN image_url text DEFAULT NULL;

-- Create public storage bucket for community images
INSERT INTO storage.buckets (id, name, public) VALUES ('community-images', 'community-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: anyone authenticated can upload
CREATE POLICY "Authenticated users can upload community images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'community-images');

-- Storage RLS: anyone can read
CREATE POLICY "Public read access for community images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'community-images');

-- Storage RLS: owner can delete own uploads
CREATE POLICY "Users can delete own community images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'community-images' AND (storage.foldername(name))[1] = auth.uid()::text);
