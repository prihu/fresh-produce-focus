

-- Update trigger to enforce quality and freshness scores >= 6
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

