
-- Create the packing-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('packing-photos', 'packing-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policy to allow authenticated users to upload photos
CREATE POLICY "Authenticated users can upload packing photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);

-- Create policy to allow anyone to view photos (since bucket is public)
CREATE POLICY "Anyone can view packing photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'packing-photos');

-- Create policy to allow authenticated users to delete their photos
CREATE POLICY "Authenticated users can delete packing photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);
