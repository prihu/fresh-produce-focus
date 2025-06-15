
CREATE POLICY "Packers can create new orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (public.check_user_role('packer'));
