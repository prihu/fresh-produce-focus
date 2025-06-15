
-- Backfill manually_created = true for existing orders that have a packer_id
-- This ensures existing users can delete their orders according to the new RLS policies
UPDATE public.orders 
SET manually_created = true 
WHERE packer_id IS NOT NULL 
  AND manually_created = false;
