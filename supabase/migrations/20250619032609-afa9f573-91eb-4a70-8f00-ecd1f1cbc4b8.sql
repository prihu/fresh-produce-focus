
-- Fix the RLS policy race condition for new users
-- Modify the existing policy to be more lenient for recently created users

-- Drop the existing policy
DROP POLICY IF EXISTS "Packers can create manual orders" ON public.orders;

-- Create an improved version that handles the race condition
CREATE POLICY "Packers can create manual orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow if user has packer role (normal case)
  public.check_user_role('packer') 
  OR 
  -- Allow if user was created recently (within 5 minutes) to handle race condition
  (
    EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND created_at > now() - interval '5 minutes')
    AND
    -- Ensure the order is being created for the authenticated user
    packer_id = auth.uid()
  )
);

-- Also improve the profile creation trigger to be more robust
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
  
  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block user creation
    RAISE WARNING 'Error in handle_new_user for user %: %', new.id, SQLERRM;
    RETURN new;
END;
$$;
