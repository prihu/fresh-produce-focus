
-- Phase 1: CRITICAL DATABASE FIXES

-- Fix the incomplete RLS policy for "Packers can create manual orders"
DROP POLICY IF EXISTS "Packers can create manual orders" ON public.orders;

CREATE POLICY "Packers can create manual orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.check_user_role('packer') 
  AND packer_id = auth.uid() 
  AND manually_created = true
);

-- Fix the existing user k4komalsinghal@gmail.com who has role but no profile
INSERT INTO public.profiles (id) 
VALUES ('3705100e-7ed2-4f83-92c8-125bfcae4eaa') 
ON CONFLICT (id) DO NOTHING;

-- Improve handle_new_user function with better conflict handling and error reporting
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Insert profile (with error handling)
  INSERT INTO public.profiles (id) 
  VALUES (new.id)
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert role (with error handling)
  INSERT INTO public.user_roles (user_id, role) 
  VALUES (new.id, 'packer')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Log successful user creation
  RAISE NOTICE 'Successfully created profile and role for user: %', new.id;
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Error in handle_new_user for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;
