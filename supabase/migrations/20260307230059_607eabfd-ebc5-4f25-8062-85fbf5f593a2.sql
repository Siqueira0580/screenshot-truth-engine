
-- Create storage bucket for composition audio
INSERT INTO storage.buckets (id, name, public) VALUES ('compositions_audio', 'compositions_audio', true);

-- Storage RLS policies
CREATE POLICY "Users can upload own composition audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'compositions_audio' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can read composition audio"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'compositions_audio');

CREATE POLICY "Users can delete own composition audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'compositions_audio' AND (storage.foldername(name))[1] = auth.uid()::text);
