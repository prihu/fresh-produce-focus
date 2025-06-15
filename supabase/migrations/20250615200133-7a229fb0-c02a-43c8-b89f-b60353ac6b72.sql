
-- 1. Add column to track whether order was manually created
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manually_created boolean NOT NULL DEFAULT false;

-- 2. Remove obsolete/overlapping policies relating to insert/update/delete/select for packers (if present)
DROP POLICY IF EXISTS "Packers can create orders for themselves" ON public.orders;
DROP POLICY IF EXISTS "Packers can create new orders" ON public.orders;
DROP POLICY IF EXISTS "Packers can view their own orders" ON public.orders;
DROP POLICY IF EXISTS "Packers can view pending orders" ON public.orders;
DROP POLICY IF EXISTS "Packers can mark orders as packed" ON public.orders;

-- 3. Packers can insert new orders for themselves; must set packer_id = auth.uid() and manually_created = true
CREATE POLICY "Packers can create manual orders" ON public.orders
FOR INSERT TO authenticated
WITH CHECK (
  packer_id = auth.uid()
  AND manually_created = true
  AND public.check_user_role('packer')
);

-- 4. Packers can view any of their orders (pending or completed)
CREATE POLICY "Packers can view their own orders" ON public.orders
FOR SELECT TO authenticated
USING (
  packer_id = auth.uid()
  AND public.check_user_role('packer')
);

-- 5. Packers can delete their own manual, uncompleted orders (never completed/assigned orders!)
CREATE POLICY "Packers can delete their own manual, uncompleted orders" ON public.orders
FOR DELETE TO authenticated
USING (
  packer_id = auth.uid()
  AND manually_created = true
  AND status != 'packed'
  AND public.check_user_role('packer')
);

-- 6. Packers CANNOT update or delete existing orders once packed (handled by lack of update/delete policy after packed)

-- 7. Packers can update only status to 'packed' IF all related photos have quality & freshness >= 5 (using trigger for enforcement after policies below)
CREATE POLICY "Packers can mark their order as packed" ON public.orders
FOR UPDATE TO authenticated
USING (
  packer_id = auth.uid()
  AND status != 'packed'
  AND public.check_user_role('packer')
)
WITH CHECK (
  packer_id = auth.uid()
  AND public.check_user_role('packer')
);

-- 8. Packers can insert/select/update their own packing_photos (see below)
DROP POLICY IF EXISTS "Packers can insert packing photos" ON public.packing_photos;
DROP POLICY IF EXISTS "Users can view related packing photos" ON public.packing_photos;

CREATE POLICY "Packers can insert packing photos for their orders" ON public.packing_photos
FOR INSERT TO authenticated
WITH CHECK (
  public.check_user_role('packer')
  AND EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND packer_id = auth.uid())
);

CREATE POLICY "Packers can select packing photos for their orders" ON public.packing_photos
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND packer_id = auth.uid())
);

-- Packers can delete packing photos before the order is packed (not after)
CREATE POLICY "Packers can delete packing photo before order packed" ON public.packing_photos
FOR DELETE TO authenticated
USING (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id = packing_photos.order_id 
       AND packer_id = auth.uid() 
       AND status != 'packed'
  )
  AND public.check_user_role('packer')
);

-- Packers can update packing photos for their current orders (needed for retries, etc.)
CREATE POLICY "Packers can update their packing photos for current orders" ON public.packing_photos
FOR UPDATE TO authenticated
USING (
  EXISTS (
     SELECT 1 FROM public.orders 
     WHERE id = packing_photos.order_id 
     AND packer_id = auth.uid() 
     AND status != 'packed'
  )
  AND public.check_user_role('packer')
);

-- 9. Add database TRIGGER to prevent completion if packing photo's quality/freshness < 5
CREATE OR REPLACE FUNCTION public.prevent_packed_if_scores_low()
RETURNS trigger AS $$
DECLARE
  low_count integer;
BEGIN
  IF NEW.status = 'packed' THEN
    SELECT COUNT(*) INTO low_count
    FROM public.packing_photos
    WHERE order_id = NEW.id
      AND (
        COALESCE(quality_score, 0) < 5
        OR COALESCE(freshness_score, 0) < 5
      );
    IF low_count > 0 THEN
      RAISE EXCEPTION 'Cannot pack order: at least one item quality or freshness score is less than 5';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_packed_if_scores_low ON public.orders;
CREATE TRIGGER trg_prevent_packed_if_scores_low
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_packed_if_scores_low();

-- 10. (Optional) Add policy for storage.objects for packers to delete images before order is packed
DROP POLICY IF EXISTS "Packers can delete photos from their orders" ON storage.objects;
CREATE POLICY "Packers can delete photos from their orders" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'packing-photos'
  AND EXISTS (
    SELECT 1 FROM public.packing_photos
    WHERE storage_path = name
      AND EXISTS (
        SELECT 1 FROM public.orders WHERE id = packing_photos.order_id AND packer_id = auth.uid() AND status != 'packed'
      )
  )
  AND public.check_user_role('packer')
);

