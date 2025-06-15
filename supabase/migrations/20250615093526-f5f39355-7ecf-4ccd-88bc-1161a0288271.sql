
-- Create a table to store product information
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  price numeric NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  is_paused boolean NOT NULL DEFAULT false
);

-- Comment on table to describe its purpose
COMMENT ON TABLE public.products IS 'Stores information about SKUs, including freshness timestamp.';

-- Enable Row Level Security for the products table
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow public read access to all products, as the page is public.
CREATE POLICY "Allow public read access to products"
ON public.products
FOR SELECT
USING (true);

-- Insert some sample data to match the frontend
-- The timestamp is set to 26 hours ago, as in the original component.
INSERT INTO public.products (name, price, checked_in_at)
VALUES ('Fresh Produce', 2.50, now() - interval '26 hours');

-- Create a table to store refunds, which is needed for the SKU flagging logic
CREATE TABLE public.refunds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Comment on table to describe its purpose
COMMENT ON TABLE public.refunds IS 'Stores refund records used for SKU quality flagging.';

-- Enable Row Level Security for the refunds table
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- For demonstration, this policy allows anyone to insert a refund.
-- In a real application, this would be restricted to authenticated users.
CREATE POLICY "Allow anonymous insert for refunds"
ON public.refunds
FOR INSERT
WITH CHECK (true);

-- Allow read access for refund calculation purposes.
CREATE POLICY "Allow public read for refunds"
ON public.refunds
FOR SELECT
USING (true);
