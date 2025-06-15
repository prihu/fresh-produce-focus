
-- Security Fixes Migration: Phase 1 (Database Hardening)

-- Section 1: User Management and Roles
-- This section sets up the foundation for role-based access control.

-- 1.1: Create an enumeration for user roles to ensure data consistency.
CREATE TYPE public.app_role AS ENUM ('packer', 'admin');

-- 1.2: Create a table for user profiles, extending the built-in auth users.
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.profiles IS 'Stores public-facing profile information for each user.';

-- 1.3: Create a table to assign roles to users.
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
COMMENT ON TABLE public.user_roles IS 'Assigns roles to users for role-based access control.';

-- 1.4: Create a helper function to securely check a user's role.
CREATE OR REPLACE FUNCTION public.check_user_role(role_to_check public.app_role)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = role_to_check
  );
END;
$$;
COMMENT ON FUNCTION public.check_user_role(public.app_role) IS 'Checks if the current user has a specific role.';

-- 1.5: Set up a trigger to automatically create a profile and assign a default 'packer' role on sign-up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (new.id);
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'packer');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Section 2: Enable Row-Level Security (RLS) and Remove Insecure Policies

-- 2.1: Make the 'packing-photos' storage bucket private.
UPDATE storage.buckets SET public = false WHERE id = 'packing-photos';

-- 2.2: Drop old, insecure public policies from tables.
DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
DROP POLICY IF EXISTS "Allow anonymous insert for refunds" ON public.refunds;
DROP POLICY IF EXISTS "Allow public read for refunds" ON public.refunds;
DROP POLICY IF EXISTS "Allow public read access to orders" ON public.orders;
DROP POLICY IF EXISTS "Allow public access to packing photos" ON public.packing_photos;

-- 2.3: Drop old, insecure public policies from storage.
DROP POLICY IF EXISTS "Allow public read access to packing photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous upload of packing photos" ON storage.objects;

-- 2.4: Enable RLS on all relevant tables.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY; -- Already enabled but confirming.

-- Section 3: Implement New, Secure RLS Policies

-- 3.1: Policies for `profiles`
CREATE POLICY "Users can view and update their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- 3.2: Policies for `user_roles`
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage user roles" ON public.user_roles FOR ALL USING (public.check_user_role('admin'));

-- 3.3: Policies for `products`
CREATE POLICY "Authenticated users can read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.check_user_role('admin'));

-- 3.4: Policies for `orders`
CREATE POLICY "Packers can view pending orders" ON public.orders FOR SELECT TO authenticated USING (status = 'pending_packing' AND public.check_user_role('packer'));
CREATE POLICY "Packers can mark orders as packed" ON public.orders FOR UPDATE TO authenticated USING (public.check_user_role('packer')) WITH CHECK (status = 'packed');
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING (public.check_user_role('admin'));

-- 3.5: Policies for `packing_photos`
CREATE POLICY "Packers can insert packing photos" ON public.packing_photos FOR INSERT TO authenticated WITH CHECK (public.check_user_role('packer'));
CREATE POLICY "Users can view related packing photos" ON public.packing_photos FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = packing_photos.order_id));
CREATE POLICY "Admins can manage packing photos" ON public.packing_photos FOR ALL USING (public.check_user_role('admin'));

-- 3.6: Policies for `refunds`
CREATE POLICY "Admins can manage refunds" ON public.refunds FOR ALL USING (public.check_user_role('admin'));

-- 3.7: Policies for `storage.objects` in 'packing-photos' bucket
CREATE POLICY "Packers can upload photos to order folders" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'packing-photos' AND public.check_user_role('packer') AND EXISTS (SELECT 1 FROM public.orders WHERE id::text = split_part(name, '/', 1)));
CREATE POLICY "Users can read photos they have access to" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'packing-photos' AND EXISTS (SELECT 1 FROM public.packing_photos WHERE storage_path = name));
CREATE POLICY "Admins have full access to storage" ON storage.objects FOR ALL USING (bucket_id = 'packing-photos' AND public.check_user_role('admin'));

