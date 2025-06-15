
-- Create a table to store order information
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending_packing', -- e.g., 'pending_packing', 'packed', 'shipped'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Comment on table to describe its purpose
COMMENT ON TABLE public.orders IS 'Stores customer order information.';

-- Enable Row Level Security for the orders table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- For demonstration, allow public access. In production, this would be restricted.
CREATE POLICY "Allow public read access to orders"
ON public.orders
FOR SELECT
USING (true);

-- Insert a sample order for the packer to work on
INSERT INTO public.orders (order_number, status) VALUES ('ORD-001', 'pending_packing');

-- Create a table to store photos taken during packing
CREATE TABLE public.packing_photos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  storage_path text NOT NULL,
  freshness_score smallint CHECK (freshness_score >= 1 AND freshness_score <= 10),
  quality_score smallint CHECK (quality_score >= 1 AND quality_score <= 10),
  description text,
  ai_analysis_status text NOT NULL DEFAULT 'pending', -- e.g., 'pending', 'completed', 'failed'
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Comment on table to describe its purpose
COMMENT ON TABLE public.packing_photos IS 'Stores photos of packed items and their AI quality analysis.';

-- Enable Row Level Security for the packing_photos table
ALTER TABLE public.packing_photos ENABLE ROW LEVEL SECURITY;

-- For demonstration, allow public access. In production, this would be restricted.
CREATE POLICY "Allow public access to packing photos"
ON public.packing_photos
FOR ALL
USING (true)
WITH CHECK (true);


-- Create a storage bucket for packing photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('packing-photos', 'packing-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for the storage bucket
-- Allow public select access to the packing-photos bucket
CREATE POLICY "Allow public read access to packing photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'packing-photos');

-- Allow anonymous insert access to the packing-photos bucket
CREATE POLICY "Allow anonymous upload of packing photos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'packing-photos');

-- Add replica identity to enable realtime on orders
ALTER TABLE public.orders REPLICA IDENTITY FULL;
-- Add orders table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Add replica identity to enable realtime on packing_photos
ALTER TABLE public.packing_photos REPLICA IDENTITY FULL;
-- Add packing_photos table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.packing_photos;
