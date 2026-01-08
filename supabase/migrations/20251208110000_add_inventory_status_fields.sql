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
  ADD COLUMN IF NOT EXISTS inventory_status text DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS low_stock_threshold integer,
  ADD COLUMN IF NOT EXISTS inventory_last_updated_at timestamptz DEFAULT now();

ALTER TABLE public.listings
  ALTER COLUMN inventory_status SET DEFAULT 'in_stock',
  ALTER COLUMN inventory_last_updated_at SET DEFAULT now();

UPDATE public.listings
  SET inventory_status = 'in_stock'
  WHERE inventory_status IS NULL;

UPDATE public.listings
  SET inventory_last_updated_at = now()
  WHERE inventory_last_updated_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_inventory_status_check'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_inventory_status_check
      CHECK (inventory_status IN (
        'in_stock',
        'low_stock',
        'out_of_stock',
        'always_available',
        'seasonal'
      ));
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_inventory_quantity_nonnegative'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_inventory_quantity_nonnegative
      CHECK (inventory_quantity IS NULL OR inventory_quantity >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_low_stock_threshold_nonnegative'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_low_stock_threshold_nonnegative
      CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0);
  END IF;
END$$;
