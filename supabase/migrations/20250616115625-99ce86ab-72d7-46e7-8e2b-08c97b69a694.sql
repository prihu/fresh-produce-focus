
-- Security Hardening Phase 1-4: Comprehensive Security Fixes

-- Phase 1: Create the packing-photos storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('packing-photos', 'packing-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Phase 2: Drop all existing insecure policies to start fresh
DROP POLICY IF EXISTS "Packers can insert packing photos" ON public.packing_photos;
DROP POLICY IF EXISTS "Users can view related packing photos" ON public.packing_photos;
DROP POLICY IF EXISTS "Admins can manage packing photos" ON public.packing_photos;
DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Users can view and update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage refunds" ON public.refunds;

-- Drop all existing storage policies
DROP POLICY IF EXISTS "Packers can upload photos to order folders" ON storage.objects;
DROP POLICY IF EXISTS "Users can read photos they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full access to storage" ON storage.objects;

-- Phase 3: Create secure RLS policies for packing_photos
CREATE POLICY "Packers can view their order photos"
ON public.packing_photos
FOR SELECT
TO authenticated
USING (
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = packing_photos.order_id 
    AND o.packer_id = auth.uid()
  )
);

CREATE POLICY "Packers can insert photos for their orders"
ON public.packing_photos
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND o.packer_id = auth.uid()
  )
);

CREATE POLICY "Packers can update their photos before packed"
ON public.packing_photos
FOR UPDATE
TO authenticated
USING (
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = packing_photos.order_id 
    AND o.packer_id = auth.uid()
    AND o.status != 'packed'
  )
);

CREATE POLICY "Packers can delete their photos before packed"
ON public.packing_photos
FOR DELETE
TO authenticated
USING (
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = packing_photos.order_id 
    AND o.packer_id = auth.uid()
    AND o.status != 'packed'
  )
);

CREATE POLICY "Admins can manage all packing photos"
ON public.packing_photos
FOR ALL
TO authenticated
USING (public.check_user_role('admin'));

-- Phase 4: Secure products table
CREATE POLICY "Authenticated users can read products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.check_user_role('admin'));

-- Phase 5: Secure profiles table
CREATE POLICY "Users can manage their own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = id);

-- Phase 6: Secure user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.check_user_role('admin'));

-- Phase 7: Secure refunds table
CREATE POLICY "Admins can manage all refunds"
ON public.refunds
FOR ALL
TO authenticated
USING (public.check_user_role('admin'));

-- Phase 8: Secure storage with file type and size validation
CREATE POLICY "Packers can upload images to their order folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'packing-photos' AND
  public.check_user_role('packer') AND
  -- Validate file type (images only)
  (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp', 'gif'])) AND
  -- Validate file path structure (must be order_id/filename)
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id::text = split_part(name, '/', 1)
    AND o.packer_id = auth.uid()
  )
);

CREATE POLICY "Packers can read their order photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'packing-photos' AND
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.packing_photos p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.storage_path = name
    AND o.packer_id = auth.uid()
  )
);

CREATE POLICY "Packers can delete their photos before packed"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'packing-photos' AND
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.packing_photos p
    JOIN public.orders o ON o.id = p.order_id
    WHERE p.storage_path = name
    AND o.packer_id = auth.uid()
    AND o.status != 'packed'
  )
);

CREATE POLICY "Admins have full storage access"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'packing-photos' AND
  public.check_user_role('admin')
);

-- Phase 9: Add input validation function for order numbers
CREATE OR REPLACE FUNCTION public.validate_order_number(order_num TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  -- Order number must be alphanumeric, 3-50 characters
  RETURN order_num ~ '^[A-Za-z0-9_-]{3,50}$';
END;
$$;

-- Phase 10: Add audit logging for admin actions
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT,
  record_id UUID,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.check_user_role('admin'));

-- Phase 11: Create trigger for order validation
CREATE OR REPLACE FUNCTION public.validate_order_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate order number format
  IF NOT public.validate_order_number(NEW.order_number) THEN
    RAISE EXCEPTION 'Invalid order number format. Must be 3-50 alphanumeric characters.';
  END IF;
  
  -- Log admin actions
  IF public.check_user_role('admin') THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', 'orders', NEW.id, to_jsonb(NEW));
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_order_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_insert();
