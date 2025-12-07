-- Create `businesses` table for YourBarrio
-- Run this in your Supabase project's SQL editor or include in your migration pipeline.

CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text,
  category text,
  description text,
  address text,
  phone text,
  website text,
  logo_url text,
  banner_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz DEFAULT now()
);

-- Enable row level security (RLS) and allow public selects
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read businesses'
  ) THEN
    CREATE POLICY "Public read businesses"
      ON public.businesses FOR SELECT USING (true);
  END IF;
END$$;

-- Optionally allow authenticated inserts/updates by business owners (example)
-- Adjust these policies to match your auth/role model before enabling.
