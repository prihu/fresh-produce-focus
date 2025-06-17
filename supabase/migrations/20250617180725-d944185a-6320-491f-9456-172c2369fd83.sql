
-- Phase 1: Update RLS Policies for Status Management
-- Modify the existing "Packers can update assigned orders" policy to include quality_checked status

DROP POLICY IF EXISTS "Packers can update assigned orders" ON public.orders;

CREATE POLICY "Packers can update assigned orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  packer_id = auth.uid() AND 
  public.check_user_role('packer') AND
  status IN ('pending_packing', 'in_progress', 'quality_checked')
)
WITH CHECK (
  packer_id = auth.uid() AND
  status IN ('pending_packing', 'in_progress', 'quality_checked', 'packed')
);

-- Modify the existing "Packers can insert photos for their orders" policy to include quality_checked status

DROP POLICY IF EXISTS "Packers can insert photos for their orders" ON public.packing_photos;

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
    AND o.status IN ('pending_packing', 'in_progress', 'quality_checked')
  )
);
