
-- Critical Security Fix: Storage Bucket Configuration
-- Fix the packing-photos bucket to be public and clean up conflicting policies

-- 1. Update the bucket to be public (this is the critical fix)
UPDATE storage.buckets 
SET public = true 
WHERE id = 'packing-photos';

-- 2. Drop all existing conflicting storage policies to start clean
DROP POLICY IF EXISTS "packing_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Packers can upload photos to order folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can read photos they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full access to storage" ON storage.objects;

-- 3. Create new, comprehensive and secure storage policies

-- Public read policy (since bucket is public, this allows image loading)
CREATE POLICY "packing_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'packing-photos');

-- Secure upload policy - only authenticated packers can upload to their order folders
CREATE POLICY "packing_photos_secure_upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
  AND public.check_user_role('packer')
  AND EXISTS (
    SELECT 1 FROM public.orders 
    WHERE id::text = split_part(name, '/', 1)
    AND packer_id = auth.uid()
    AND status != 'packed'
  )
);

-- Secure delete policy - only allow deletion of photos from unpacked orders by the packer who created them
CREATE POLICY "packing_photos_secure_delete"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
  AND (
    public.check_user_role('admin')
    OR (
      public.check_user_role('packer')
      AND EXISTS (
        SELECT 1 FROM public.orders 
        WHERE id::text = split_part(name, '/', 1)
        AND packer_id = auth.uid()
        AND status != 'packed'
      )
    )
  )
);

-- Update policy for file metadata (rare, but secure)
CREATE POLICY "packing_photos_secure_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'packing-photos' 
  AND auth.role() = 'authenticated'
  AND (
    public.check_user_role('admin')
    OR (
      public.check_user_role('packer')
      AND EXISTS (
        SELECT 1 FROM public.orders 
        WHERE id::text = split_part(name, '/', 1)
        AND packer_id = auth.uid()
        AND status != 'packed'
      )
    )
  )
);

-- 4. Verify the bucket is properly configured
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets 
    WHERE id = 'packing-photos' AND public = true
  ) THEN
    RAISE EXCEPTION 'Critical: packing-photos bucket must be public for image loading to work';
  END IF;
END $$;
