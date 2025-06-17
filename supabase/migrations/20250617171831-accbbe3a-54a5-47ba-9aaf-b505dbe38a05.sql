
-- Fix the database constraint to allow 0 scores for non-produce items
-- Drop the existing constraint that's too restrictive
ALTER TABLE public.packing_photos 
DROP CONSTRAINT IF EXISTS packing_photos_freshness_score_check;

ALTER TABLE public.packing_photos 
DROP CONSTRAINT IF EXISTS packing_photos_quality_score_check;

-- Add new constraints that allow 0 scores (for non-produce items)
-- but still validate that scores are in valid range when present
ALTER TABLE public.packing_photos 
ADD CONSTRAINT packing_photos_freshness_score_check 
CHECK (freshness_score IS NULL OR (freshness_score >= 0 AND freshness_score <= 10));

ALTER TABLE public.packing_photos 
ADD CONSTRAINT packing_photos_quality_score_check 
CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 10));

-- Update the trigger to allow 0 scores for non-produce items
-- The trigger should prevent packing only when scores are below 6 for actual produce
DROP TRIGGER IF EXISTS prevent_packed_trigger ON public.orders;

CREATE OR REPLACE FUNCTION public.prevent_packed_if_scores_low()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  low_count integer;
  non_produce_count integer;
BEGIN
  IF NEW.status = 'packed' THEN
    -- Check for low quality or freshness scores (must be >= 6)
    SELECT COUNT(*) INTO low_count
    FROM public.packing_photos
    WHERE order_id = NEW.id
      AND (
        COALESCE(quality_score, 0) < 6
        OR COALESCE(freshness_score, 0) < 6
      );
    
    -- Check for non-produce items
    SELECT COUNT(*) INTO non_produce_count
    FROM public.packing_photos
    WHERE order_id = NEW.id
      AND (
        item_name IS NULL 
        OR lower(item_name) SIMILAR TO '%not%produce%|%no%produce%|%unidentified%|%unclear%|%not%food%'
      );
    
    IF low_count > 0 THEN
      RAISE EXCEPTION 'Cannot pack order: at least one item has quality or freshness score less than 6';
    END IF;
    
    IF non_produce_count > 0 THEN
      RAISE EXCEPTION 'Cannot pack order: at least one item is not identified as produce';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
CREATE TRIGGER prevent_packed_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_packed_if_scores_low();
