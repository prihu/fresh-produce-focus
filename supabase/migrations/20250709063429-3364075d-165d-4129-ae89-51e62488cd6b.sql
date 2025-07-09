
-- Security Fix: Add missing INSERT policy for audit_log table
-- This enables admin users to create audit entries properly

CREATE POLICY "Admins can insert audit logs"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (public.check_user_role('admin'));

-- Security Enhancement: Add database-level rate limiting function
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  operation_type TEXT,
  max_requests INTEGER DEFAULT 100,
  window_minutes INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_count INTEGER;
  window_start TIMESTAMP;
BEGIN
  -- Calculate window start time
  window_start := NOW() - (window_minutes || ' minutes')::INTERVAL;
  
  -- Count recent requests for this user and operation
  SELECT COUNT(*) INTO request_count
  FROM public.audit_log
  WHERE user_id = auth.uid()
    AND action = operation_type
    AND created_at >= window_start;
  
  -- Return true if under limit
  RETURN request_count < max_requests;
END;
$$;

-- Security Enhancement: Add comprehensive audit logging for sensitive operations
CREATE OR REPLACE FUNCTION public.audit_comprehensive_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enhanced audit logging for all sensitive table operations
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values, new_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_values)
    VALUES (auth.uid(), TG_OP, TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Apply comprehensive audit triggers to sensitive tables
DROP TRIGGER IF EXISTS audit_user_roles_changes ON public.user_roles;
CREATE TRIGGER audit_user_roles_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_comprehensive_operations();

DROP TRIGGER IF EXISTS audit_packing_photos_changes ON public.packing_photos;
CREATE TRIGGER audit_packing_photos_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.packing_photos
  FOR EACH ROW EXECUTE FUNCTION public.audit_comprehensive_operations();
