
-- Fix packing-photos bucket configuration for proper public access
UPDATE storage.buckets 
SET public = true 
WHERE id = 'packing-photos';

-- Ensure proper read access policy exists
DROP POLICY IF EXISTS "Public can view packing photos" ON storage.objects;
CREATE POLICY "Public can view packing photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'packing-photos');
