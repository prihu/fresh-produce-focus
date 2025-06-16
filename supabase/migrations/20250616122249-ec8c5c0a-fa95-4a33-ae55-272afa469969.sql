
-- Phase 1: Fix Function Search Path Security
-- Update validate_order_number function with proper security settings
CREATE OR REPLACE FUNCTION public.validate_order_number(order_num text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Order number must be alphanumeric, 3-50 characters
  RETURN order_num ~ '^[A-Za-z0-9_-]{3,50}$';
END;
$function$;

-- Update validate_order_insert function with proper security settings
CREATE OR REPLACE FUNCTION public.validate_order_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- Update prevent_packed_if_scores_low function with proper security settings
CREATE OR REPLACE FUNCTION public.prevent_packed_if_scores_low()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- Phase 4: Create Database Triggers (if they don't exist)
-- Create trigger for order validation
DROP TRIGGER IF EXISTS validate_order_trigger ON public.orders;
CREATE TRIGGER validate_order_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_insert();

-- Create trigger for packing quality control
DROP TRIGGER IF EXISTS prevent_packed_if_scores_low_trigger ON public.orders;
CREATE TRIGGER prevent_packed_if_scores_low_trigger
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_packed_if_scores_low();
