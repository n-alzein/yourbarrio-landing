SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- PUBLIC SCHEMA
CREATE SCHEMA IF NOT EXISTS public;
ALTER SCHEMA public OWNER TO pg_database_owner;
COMMENT ON SCHEMA public IS 'standard public schema';

-- TABLES
CREATE TABLE IF NOT EXISTS public.listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    price numeric(10,2),
    category text,
    city text,
    photo_url text,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.listings OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.saved_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    listing_id uuid,
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.saved_listings OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.users (
    id uuid NOT NULL,
    email text,
    role text DEFAULT 'customer' NOT NULL,
    full_name text,
    profile_photo_url text,
    phone text,
    business_name text,
    category text,
    description text,
    website text,
    address text,
    city text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.users OWNER TO postgres;

-----------------------------------------------------------
-- PRIMARY KEYS (SAFE)
-----------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_pkey'
  ) THEN
    ALTER TABLE public.listings ADD CONSTRAINT listings_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_listings_pkey'
  ) THEN
    ALTER TABLE public.saved_listings ADD CONSTRAINT saved_listings_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_pkey'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
  END IF;
END$$;

-----------------------------------------------------------
-- FOREIGN KEYS (SAFE)
-----------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_listings_listing_id_fkey'
  ) THEN
    ALTER TABLE public.saved_listings
      ADD CONSTRAINT saved_listings_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_listings_user_id_fkey'
  ) THEN
    ALTER TABLE public.saved_listings
      ADD CONSTRAINT saved_listings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_id_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

-----------------------------------------------------------
-- ENABLE RLS
-----------------------------------------------------------

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

-----------------------------------------------------------
-- RLS POLICIES (SAFE)
-----------------------------------------------------------

-- Public read listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read listings'
  ) THEN
    CREATE POLICY "Public read listings"
      ON public.listings FOR SELECT USING (true);
  END IF;
END$$;

-- Businesses can insert listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Businesses can insert listings'
  ) THEN
    CREATE POLICY "Businesses can insert listings"
      ON public.listings FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = business_id);
  END IF;
END$$;

-- Businesses can update own listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Businesses can update own listings'
  ) THEN
    CREATE POLICY "Businesses can update own listings"
      ON public.listings FOR UPDATE TO authenticated
      USING (auth.uid() = business_id);
  END IF;
END$$;

-- Business owners can delete listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Business owners can delete own listings'
  ) THEN
    CREATE POLICY "Business owners can delete own listings"
      ON public.listings FOR DELETE TO authenticated
      USING (auth.uid() = business_id);
  END IF;
END$$;

-- User can insert saved listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'User can insert saved listings'
  ) THEN
    CREATE POLICY "User can insert saved listings"
      ON public.saved_listings FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

-- User can view saved listings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'User can view saved listings'
  ) THEN
    CREATE POLICY "User can view saved listings"
      ON public.saved_listings FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;
