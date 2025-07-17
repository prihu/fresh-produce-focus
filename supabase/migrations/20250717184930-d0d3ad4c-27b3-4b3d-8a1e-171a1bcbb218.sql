-- Fix audit trigger to handle NULL user_id from edge functions
-- This prevents packing_photos updates from failing when called from analyze-image edge function

CREATE OR REPLACE FUNCTION public.audit_comprehensive_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enhanced audit logging for all sensitive table operations
  -- Handle NULL user_id gracefully for edge function operations
  DECLARE
    audit_user_id uuid;
  BEGIN
    -- Use auth.uid() if available, otherwise use a system identifier
    audit_user_id := auth.uid();
    
    IF audit_user_id IS NULL THEN
      -- For edge function operations, use a special system UUID
      audit_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
    END IF;
    
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
      VALUES (audit_user_id, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
      VALUES (audit_user_id, TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
      VALUES (audit_user_id, TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
END;
$$;