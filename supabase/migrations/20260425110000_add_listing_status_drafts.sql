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

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS status text;

ALTER TABLE public.listings
  ALTER COLUMN status SET DEFAULT 'draft';

DO $$
DECLARE
  has_is_published boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'is_published'
  )
  INTO has_is_published;

  IF has_is_published THEN
    UPDATE public.listings
    SET status = CASE
      WHEN COALESCE(is_published, false) THEN 'published'
      ELSE 'draft'
    END
    WHERE status IS NULL OR btrim(status) = '';

    UPDATE public.listings
    SET is_published = (status = 'published')
    WHERE is_published IS DISTINCT FROM (status = 'published');
  ELSE
    UPDATE public.listings
    SET status = 'published'
    WHERE status IS NULL OR btrim(status) = '';
  END IF;
END;
$$;

ALTER TABLE public.listings
  ALTER COLUMN status SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'listings_status_check'
      AND conrelid = 'public.listings'::regclass
  ) THEN
    ALTER TABLE public.listings
      DROP CONSTRAINT listings_status_check;
  END IF;
END;
$$;

ALTER TABLE public.listings
  ADD CONSTRAINT listings_status_check
  CHECK (status IN ('draft', 'published'));

CREATE INDEX IF NOT EXISTS listings_business_status_idx
  ON public.listings (business_id, status, created_at DESC);

NOTIFY pgrst, 'reload schema';
