
-- Ensure packing-photos bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('packing-photos', 'packing-photos', true, 15728640, ARRAY['image/*'])
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['image/*'];

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Allow public read access to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view packing photos" ON storage.objects;

-- Create comprehensive public read policy
CREATE POLICY "packing_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'packing-photos');

-- Allow authenticated uploads
CREATE POLICY "packing_photos_authenticated_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated updates
CREATE POLICY "packing_photos_authenticated_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);

-- Allow authenticated deletes
CREATE POLICY "packing_photos_authenticated_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
);

-- Verify bucket configuration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'packing-photos' AND public = true
  ) THEN
    RAISE EXCEPTION 'packing-photos bucket is not properly configured as public';
  END IF;
END $$;
