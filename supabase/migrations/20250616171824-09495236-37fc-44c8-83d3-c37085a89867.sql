
-- Comprehensive Security Fixes Migration
-- Phase 1: Fix RLS Policy Conflicts and Critical Security Issues

-- Drop all existing conflicting policies to start fresh
DROP POLICY IF EXISTS "Packers can view their order photos" ON public.packing_photos;
DROP POLICY IF EXISTS "Packers can insert photos for their orders" ON public.packing_photos;
DROP POLICY IF EXISTS "Packers can update their photos before packed" ON public.packing_photos;
DROP POLICY IF EXISTS "Packers can delete their photos before packed" ON public.packing_photos;
DROP POLICY IF EXISTS "Admins can manage all packing photos" ON public.packing_photos;

DROP POLICY IF EXISTS "Packers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Packers can update their own orders" ON public.orders;
DROP POLICY IF EXISTS "Packers can create orders for themselves" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

DROP POLICY IF EXISTS "Authenticated users can read products" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.products;

DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all refunds" ON public.refunds;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_log;

-- Drop storage policies
DROP POLICY IF EXISTS "Packers can upload images to their order folders" ON storage.objects;
DROP POLICY IF EXISTS "Packers can read their order photos" ON storage.objects;
DROP POLICY IF EXISTS "Packers can delete their photos before packed" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full storage access" ON storage.objects;

-- Create secure RLS policies for orders with proper packer_id validation
CREATE POLICY "Packers can view assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  packer_id = auth.uid() AND 
  public.check_user_role('packer')
);

CREATE POLICY "Packers can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  packer_id = auth.uid() AND 
  public.check_user_role('packer') AND
  status IN ('pending_packing', 'in_progress')
)
WITH CHECK (
  packer_id = auth.uid() AND
  status IN ('pending_packing', 'in_progress', 'packed')
);

CREATE POLICY "Packers can create orders with themselves as packer"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  packer_id = auth.uid() AND 
  public.check_user_role('packer') AND
  manually_created = true
);

CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.check_user_role('admin'))
WITH CHECK (public.check_user_role('admin'));

-- Create secure RLS policies for packing_photos with proper order ownership validation
CREATE POLICY "Packers can view photos for their orders"
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
    AND o.status IN ('pending_packing', 'in_progress')
  )
);

CREATE POLICY "Packers can update photos for their unpacked orders"
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
)
WITH CHECK (
  public.check_user_role('packer') AND
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id = order_id 
    AND o.packer_id = auth.uid()
    AND o.status != 'packed'
  )
);

CREATE POLICY "Packers can delete photos for their unpacked orders"
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
USING (public.check_user_role('admin'))
WITH CHECK (public.check_user_role('admin'));

-- Secure products table
CREATE POLICY "Authenticated users can read products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage products"
ON public.products
FOR ALL
TO authenticated
USING (public.check_user_role('admin'))
WITH CHECK (public.check_user_role('admin'));

-- Secure profiles table
CREATE POLICY "Users can manage their own profile"
ON public.profiles
FOR ALL
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Secure user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all user roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.check_user_role('admin'))
WITH CHECK (public.check_user_role('admin'));

-- Secure refunds table
CREATE POLICY "Admins can manage all refunds"
ON public.refunds
FOR ALL
TO authenticated
USING (public.check_user_role('admin'))
WITH CHECK (public.check_user_role('admin'));

-- Secure audit_log table
CREATE POLICY "Admins can view audit logs"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.check_user_role('admin'));

-- Create secure storage policies with proper file validation
CREATE POLICY "Packers can upload images to their order folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'packing-photos' AND
  public.check_user_role('packer') AND
  -- Validate file extension
  (storage.extension(name) = ANY(ARRAY['jpg', 'jpeg', 'png', 'webp'])) AND
  -- Validate order ownership and path structure
  EXISTS (
    SELECT 1 FROM public.orders o 
    WHERE o.id::text = split_part(name, '/', 1)
    AND o.packer_id = auth.uid()
    AND o.status IN ('pending_packing', 'in_progress')
  )
);

CREATE POLICY "Packers can read their order photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'packing-photos' AND
  (
    public.check_user_role('packer') AND
    EXISTS (
      SELECT 1 FROM public.packing_photos p
      JOIN public.orders o ON o.id = p.order_id
      WHERE p.storage_path = name
      AND o.packer_id = auth.uid()
    )
  )
);

CREATE POLICY "Packers can delete their photos for unpacked orders"
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
)
WITH CHECK (
  bucket_id = 'packing-photos' AND
  public.check_user_role('admin')
);

-- Add security function for order number validation (enhanced)
CREATE OR REPLACE FUNCTION public.validate_order_number_secure(order_num text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Prevent null/empty values
  IF order_num IS NULL OR trim(order_num) = '' THEN
    RETURN false;
  END IF;
  
  -- Order number must be alphanumeric with dashes/underscores, 3-50 characters
  RETURN order_num ~ '^[A-Za-z0-9_-]{3,50}$';
END;
$$;

-- Update validation trigger to use secure function
CREATE OR REPLACE FUNCTION public.validate_order_insert_secure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate order number format
  IF NOT public.validate_order_number_secure(NEW.order_number) THEN
    RAISE EXCEPTION 'Invalid order number format. Must be 3-50 alphanumeric characters with dashes/underscores only.';
  END IF;
  
  -- Ensure packer_id is set for manually created orders
  IF NEW.manually_created = true AND NEW.packer_id IS NULL THEN
    RAISE EXCEPTION 'Packer ID must be set for manually created orders.';
  END IF;
  
  -- Validate packer_id matches authenticated user for manual orders
  IF NEW.manually_created = true AND NEW.packer_id != auth.uid() THEN
    RAISE EXCEPTION 'Cannot create order for another packer.';
  END IF;
  
  -- Log admin actions
  IF public.check_user_role('admin') THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), 'INSERT', 'orders', NEW.id, to_jsonb(NEW));
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger with secure function
DROP TRIGGER IF EXISTS validate_order_trigger ON public.orders;
CREATE TRIGGER validate_order_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_insert_secure();

-- Add constraint to ensure packer_id is not null for manually created orders
ALTER TABLE public.orders ADD CONSTRAINT ensure_packer_for_manual_orders 
CHECK (
  (manually_created = false) OR 
  (manually_created = true AND packer_id IS NOT NULL)
);

-- Add audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_sensitive_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log order status changes
  IF TG_TABLE_NAME = 'orders' AND OLD.status != NEW.status THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (
      auth.uid(), 
      'STATUS_CHANGE', 
      'orders', 
      NEW.id, 
      jsonb_build_object('old_status', OLD.status),
      jsonb_build_object('new_status', NEW.status, 'changed_at', now())
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create audit trigger for order status changes
DROP TRIGGER IF EXISTS audit_order_changes ON public.orders;
CREATE TRIGGER audit_order_changes
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_operations();
