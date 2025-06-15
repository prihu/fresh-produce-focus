
-- Add packer_id column to orders table to associate orders with packers
ALTER TABLE public.orders ADD COLUMN packer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Drop old, non-specific packer policies
DROP POLICY IF EXISTS "Packers can view pending orders" ON public.orders;
DROP POLICY IF EXISTS "Packers can mark orders as packed" ON public.orders;
DROP POLICY IF EXISTS "Packers can create new orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

-- Create new policy for packers to view only their assigned orders
CREATE POLICY "Packers can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (packer_id = auth.uid() AND public.check_user_role('packer'));

-- Create new policy for packers to update only their assigned orders
CREATE POLICY "Packers can update their own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (packer_id = auth.uid() AND public.check_user_role('packer'))
WITH CHECK (packer_id = auth.uid());

-- Create new policy for packers to create orders for themselves
CREATE POLICY "Packers can create orders for themselves"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (packer_id = auth.uid() AND public.check_user_role('packer'));

-- Create a comprehensive policy for admins to manage all orders
CREATE POLICY "Admins can manage all orders"
ON public.orders
FOR ALL
TO authenticated
USING (public.check_user_role('admin'))
WITH CHECK (public.check_user_role('admin'));
