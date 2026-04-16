BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS pickup_enabled_default boolean,
  ADD COLUMN IF NOT EXISTS local_delivery_enabled_default boolean,
  ADD COLUMN IF NOT EXISTS default_delivery_fee_cents integer,
  ADD COLUMN IF NOT EXISTS delivery_radius_miles numeric(6,2),
  ADD COLUMN IF NOT EXISTS delivery_min_order_cents integer,
  ADD COLUMN IF NOT EXISTS delivery_notes text;

UPDATE public.businesses
SET pickup_enabled_default = true
WHERE pickup_enabled_default IS NULL;

UPDATE public.businesses
SET local_delivery_enabled_default = false
WHERE local_delivery_enabled_default IS NULL;

ALTER TABLE public.businesses
  ALTER COLUMN pickup_enabled_default SET DEFAULT true,
  ALTER COLUMN pickup_enabled_default SET NOT NULL,
  ALTER COLUMN local_delivery_enabled_default SET DEFAULT false,
  ALTER COLUMN local_delivery_enabled_default SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_default_delivery_fee_cents_nonnegative'
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_default_delivery_fee_cents_nonnegative
      CHECK (default_delivery_fee_cents IS NULL OR default_delivery_fee_cents >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_delivery_radius_miles_nonnegative'
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_delivery_radius_miles_nonnegative
      CHECK (delivery_radius_miles IS NULL OR delivery_radius_miles >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_delivery_min_order_cents_nonnegative'
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_delivery_min_order_cents_nonnegative
      CHECK (delivery_min_order_cents IS NULL OR delivery_min_order_cents >= 0);
  END IF;
END $$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean,
  ADD COLUMN IF NOT EXISTS local_delivery_enabled boolean,
  ADD COLUMN IF NOT EXISTS delivery_fee_cents integer,
  ADD COLUMN IF NOT EXISTS use_business_delivery_defaults boolean;

UPDATE public.listings
SET pickup_enabled = true
WHERE pickup_enabled IS NULL;

UPDATE public.listings
SET local_delivery_enabled = false
WHERE local_delivery_enabled IS NULL;

UPDATE public.listings
SET use_business_delivery_defaults = true
WHERE use_business_delivery_defaults IS NULL;

ALTER TABLE public.listings
  ALTER COLUMN pickup_enabled SET DEFAULT true,
  ALTER COLUMN pickup_enabled SET NOT NULL,
  ALTER COLUMN local_delivery_enabled SET DEFAULT false,
  ALTER COLUMN local_delivery_enabled SET NOT NULL,
  ALTER COLUMN use_business_delivery_defaults SET DEFAULT true,
  ALTER COLUMN use_business_delivery_defaults SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_delivery_fee_cents_nonnegative'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_delivery_fee_cents_nonnegative
      CHECK (delivery_fee_cents IS NULL OR delivery_fee_cents >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'carts'
      AND column_name = 'fulfillment_type'
  ) THEN
    UPDATE public.carts
    SET fulfillment_type = 'pickup'
    WHERE fulfillment_type IS NULL;

    ALTER TABLE public.carts
      ALTER COLUMN fulfillment_type SET DEFAULT 'pickup',
      ALTER COLUMN fulfillment_type SET NOT NULL;
  END IF;
END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_fee_cents_snapshot integer,
  ADD COLUMN IF NOT EXISTS delivery_notes_snapshot text;

UPDATE public.orders
SET delivery_fee_cents_snapshot = 0
WHERE delivery_fee_cents_snapshot IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN delivery_fee_cents_snapshot SET DEFAULT 0,
  ALTER COLUMN delivery_fee_cents_snapshot SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_delivery_fee_cents_snapshot_nonnegative'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_delivery_fee_cents_snapshot_nonnegative
      CHECK (delivery_fee_cents_snapshot >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orders'
      AND column_name = 'fulfillment_type'
  ) THEN
    UPDATE public.orders
    SET fulfillment_type = 'pickup'
    WHERE fulfillment_type IS NULL;
  END IF;
END $$;

COMMIT;
