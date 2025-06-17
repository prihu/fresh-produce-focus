
-- Phase 2: RLS Policy Cleanup & Consolidation
-- Delete redundant policies to eliminate conflicts and improve security clarity

-- 1. Orders Table - Delete redundant policy
DROP POLICY IF EXISTS "Packers can create orders with themselves as packer" ON public.orders;

-- 2. Packing Photos Table - Delete redundant policies
DROP POLICY IF EXISTS "Packers can delete packing photo before order packed" ON public.packing_photos;
DROP POLICY IF EXISTS "Packers can insert packing photos for their orders" ON public.packing_photos;
DROP POLICY IF EXISTS "Packers can select packing photos for their orders" ON public.packing_photos;
DROP POLICY IF EXISTS "Packers can update their packing photos for current orders" ON public.packing_photos;

-- 3. Storage Objects Table - Delete redundant and less secure policies
DROP POLICY IF EXISTS "Packers can delete photos from their orders" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_secure_delete" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_secure_update" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_secure_upload" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "packing_photos_authenticated_delete" ON storage.objects;

-- Additional cleanup - Remove any other conflicting policies that may exist
DROP POLICY IF EXISTS "Allow public read access to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated upload to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete from packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view packing photos" ON storage.objects;

-- Verify remaining policies are the ones we want to keep
-- The following policies should remain active after cleanup:

-- Orders table policies (should remain):
-- - "Packers can view assigned orders"
-- - "Packers can update assigned orders" 
-- - "Packers can create manual orders"
-- - "Admins can manage all orders"

-- Packing photos table policies (should remain):
-- - "Packers can view photos for their orders"
-- - "Packers can insert photos for their orders"
-- - "Packers can update photos for their unpacked orders"
-- - "Packers can delete photos for their unpacked orders"
-- - "Admins can manage all packing photos"

-- Storage objects policies (should remain):
-- - "Packers can upload images to their order folders"
-- - "Packers can read their order photos"
-- - "Packers can delete their photos for unpacked orders"
-- - "Admins have full storage access"
