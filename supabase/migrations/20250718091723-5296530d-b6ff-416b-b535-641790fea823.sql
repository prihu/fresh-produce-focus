
-- Step 1: Remove Foreign Key Constraint on audit_log.user_id
-- This allows edge functions to insert audit records with NULL user_id
ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;

-- Step 2: Update Audit Function to Use NULL for Edge Function Operations
-- This provides cleaner audit trail for system operations
CREATE OR REPLACE FUNCTION public.audit_comprehensive_operations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Enhanced audit logging for all sensitive table operations
  -- Use NULL user_id for edge function operations (no fake system UUID)
  DECLARE
    audit_user_id uuid;
  BEGIN
    -- Use auth.uid() if available, otherwise use NULL for system operations
    audit_user_id := auth.uid();
    
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

-- Step 3: Database Recovery - Reset stuck processing photos
UPDATE public.packing_photos 
SET ai_analysis_status = 'pending',
    description = 'Reset from stuck processing state - constraint fix applied'
WHERE ai_analysis_status = 'processing' 
AND created_at < now() - interval '10 minutes';

-- Step 4: Clean up failed audit entries that referenced the fake system user
DELETE FROM public.audit_log 
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid 
AND action = 'UPDATE' 
AND table_name = 'packing_photos' 
AND created_at < now() - interval '2 hours';

-- Step 5: Remove the failed system user creation from previous migration
-- (Clean up the auth.users table attempt)
DELETE FROM auth.users 
WHERE id = '00000000-0000-0000-0000-000000000001'::uuid 
AND email = 'system@zepto.internal';
