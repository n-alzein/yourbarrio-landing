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

CREATE TABLE IF NOT EXISTS public.business_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    viewer_id uuid,
    viewed_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.business_views OWNER TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_views_pkey'
  ) THEN
    ALTER TABLE public.business_views ADD CONSTRAINT business_views_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_views_business_id_fkey'
  ) THEN
    ALTER TABLE public.business_views
      ADD CONSTRAINT business_views_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'business_views_viewer_id_fkey'
  ) THEN
    ALTER TABLE public.business_views
      ADD CONSTRAINT business_views_viewer_id_fkey
      FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS business_views_business_id_idx
  ON public.business_views (business_id);

CREATE INDEX IF NOT EXISTS business_views_viewed_at_idx
  ON public.business_views (viewed_at DESC);

ALTER TABLE public.business_views ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can insert business views'
  ) THEN
    CREATE POLICY "Public can insert business views"
      ON public.business_views FOR INSERT
      WITH CHECK (viewer_id IS NULL OR viewer_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Businesses can read own business views'
  ) THEN
    CREATE POLICY "Businesses can read own business views"
      ON public.business_views FOR SELECT TO authenticated
      USING (auth.uid() = business_id);
  END IF;
END$$;
