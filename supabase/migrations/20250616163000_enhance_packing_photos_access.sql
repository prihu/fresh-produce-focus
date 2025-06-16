
-- Drop existing policies to recreate them
DROP POLICY IF EXISTS "Public can view packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete packing photos" ON storage.objects;

-- Ensure the bucket is public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'packing-photos';

-- Create a very permissive policy for viewing photos
CREATE POLICY "Allow public read access to packing photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'packing-photos');

-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated upload to packing photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete
CREATE POLICY "Allow authenticated delete from packing photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);
