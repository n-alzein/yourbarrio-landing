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
  ADD COLUMN IF NOT EXISTS business_entity_id uuid NULL REFERENCES public.businesses(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.listings.business_id IS
  'Legacy field. Historically stores businesses.owner_user_id, not businesses.id. Prefer listings.business_entity_id for canonical business references.';

COMMENT ON COLUMN public.listings.business_entity_id IS
  'Canonical reference to businesses.id. Added to resolve legacy listings.business_id behavior, where listings.business_id historically stored businesses.owner_user_id.';

UPDATE public.listings l
SET business_entity_id = b.id
FROM public.businesses b
WHERE l.business_entity_id IS NULL
  AND b.owner_user_id = l.business_id;

CREATE INDEX IF NOT EXISTS listings_business_entity_id_idx
  ON public.listings (business_entity_id);

CREATE INDEX IF NOT EXISTS listings_business_entity_active_idx
  ON public.listings (business_entity_id, status, admin_hidden, deleted_at)
  WHERE business_entity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_listing_business_entity_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Transitional ownership model:
  -- - listings.business_id remains the legacy owner auth user id.
  -- - listings.business_entity_id is the canonical businesses.id reference.
  -- Browser listing writes may still omit business_entity_id, so populate it
  -- opportunistically from the legacy owner mapping.
  IF NEW.business_entity_id IS NULL AND NEW.business_id IS NOT NULL THEN
    SELECT b.id
    INTO NEW.business_entity_id
    FROM public.businesses b
    WHERE b.owner_user_id = NEW.business_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_set_business_entity_id ON public.listings;
CREATE TRIGGER listings_set_business_entity_id
BEFORE INSERT OR UPDATE OF business_id, business_entity_id ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.set_listing_business_entity_id();

CREATE OR REPLACE FUNCTION public.enforce_business_active_listing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_owner_user_id uuid;
  v_limit integer;
  v_active_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;

  -- Prefer the canonical businesses.id reference when available. Legacy rows
  -- still resolve through listings.business_id -> businesses.owner_user_id.
  IF NEW.business_entity_id IS NOT NULL THEN
    SELECT b.id, b.owner_user_id
    INTO v_business_id, v_owner_user_id
    FROM public.businesses b
    WHERE b.id = NEW.business_entity_id
    LIMIT 1;
  ELSE
    SELECT b.id, b.owner_user_id
    INTO v_business_id, v_owner_user_id
    FROM public.businesses b
    WHERE b.owner_user_id = NEW.business_id
    LIMIT 1;
  END IF;

  IF v_business_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := public.get_business_numeric_entitlement(v_business_id, 'listings.active_limit')::integer;
  IF v_limit IS NULL OR v_limit <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO v_active_count
  FROM public.listings l
  WHERE l.status = 'published'
    AND coalesce(l.admin_hidden, false) = false
    AND l.deleted_at IS NULL
    AND l.id IS DISTINCT FROM NEW.id
    AND (
      l.business_entity_id = v_business_id
      OR (
        l.business_entity_id IS NULL
        AND v_owner_user_id IS NOT NULL
        AND l.business_id = v_owner_user_id
      )
      OR (
        v_owner_user_id IS NOT NULL
        AND l.business_id = v_owner_user_id
      )
    );

  IF v_active_count >= v_limit THEN
    RAISE EXCEPTION 'Active listing limit reached for this business.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_active_listing_limit ON public.listings;
CREATE TRIGGER listings_enforce_active_listing_limit
BEFORE INSERT OR UPDATE OF status, admin_hidden, deleted_at ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_active_listing_limit();

DROP POLICY IF EXISTS "Businesses can insert listings" ON public.listings;
CREATE POLICY "Businesses can insert listings"
  ON public.listings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = business_id
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = listings.business_entity_id
        AND b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Businesses can update own listings" ON public.listings;
CREATE POLICY "Businesses can update own listings"
  ON public.listings FOR UPDATE TO authenticated
  USING (
    auth.uid() = business_id
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = listings.business_entity_id
        AND b.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = business_id
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = listings.business_entity_id
        AND b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Business owners can delete own listings" ON public.listings;
CREATE POLICY "Business owners can delete own listings"
  ON public.listings FOR DELETE TO authenticated
  USING (
    auth.uid() = business_id
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = listings.business_entity_id
        AND b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Businesses can read own listings" ON public.listings;
CREATE POLICY "Businesses can read own listings"
  ON public.listings FOR SELECT TO authenticated
  USING (
    auth.uid() = business_id
    OR EXISTS (
      SELECT 1
      FROM public.businesses b
      WHERE b.id = listings.business_entity_id
        AND b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Public can read verified listings" ON public.listings;
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
  ) INTO has_is_published;

  IF has_is_published THEN
    EXECUTE $sql$
      CREATE POLICY "Public can read verified listings"
        ON public.listings
        FOR SELECT
        TO anon, authenticated
        USING (
          is_published = true
          AND EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE (
                b.id = listings.business_entity_id
                OR (listings.business_entity_id IS NULL AND b.owner_user_id = listings.business_id)
              )
              AND b.verification_status IN ('auto_verified', 'manually_verified')
          )
        )
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE POLICY "Public can read verified listings"
        ON public.listings
        FOR SELECT
        TO anon, authenticated
        USING (
          EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE (
                b.id = listings.business_entity_id
                OR (listings.business_entity_id IS NULL AND b.owner_user_id = listings.business_id)
              )
              AND b.verification_status IN ('auto_verified', 'manually_verified')
          )
        )
    $sql$;
  END IF;
END $$;

DROP POLICY IF EXISTS media_assets_public_active_select ON public.media_assets;
CREATE POLICY media_assets_public_active_select
  ON public.media_assets FOR SELECT
  USING (
    status = 'active'
    AND (
      EXISTS (
        SELECT 1
        FROM public.listings l
        JOIN public.businesses b
          ON b.id = l.business_entity_id
          OR (l.business_entity_id IS NULL AND b.owner_user_id = l.business_id)
        WHERE l.id = media_assets.listing_id
          AND COALESCE(l.admin_hidden, false) = false
          AND l.deleted_at IS NULL
          AND l.status = 'published'
          AND (
            COALESCE(b.verification_status, '') IN ('verified', 'approved', 'auto_verified', 'manually_verified')
            OR COALESCE(b.is_internal, false) = true
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.businesses b
        WHERE b.id = media_assets.business_id
          AND (
            COALESCE(b.verification_status, '') IN ('verified', 'approved', 'auto_verified', 'manually_verified')
            OR COALESCE(b.is_internal, false) = true
          )
      )
    )
  );

DO $$
DECLARE
  has_is_test boolean;
  has_status boolean;
  has_is_published boolean;
  select_is_test_column text;
  where_status text;
  where_is_published text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'is_test'
  ) INTO has_is_test;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'status'
  ) INTO has_status;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'is_published'
  ) INTO has_is_published;

  select_is_test_column := CASE
    WHEN has_is_test THEN 'l.is_test,'
    ELSE 'false AS is_test,'
  END;

  where_status := CASE
    WHEN has_status THEN ' AND l.status = ''published'''
    ELSE ''
  END;

  where_is_published := CASE
    WHEN has_is_published THEN ' AND l.is_published = true'
    ELSE ''
  END;

  EXECUTE format(
    $sql$
      CREATE OR REPLACE VIEW public.public_listings_v AS
      SELECT
        l.id,
        l.business_id,
        l.title,
        l.description,
        l.price,
        l.category,
        l.city,
        l.photo_url,
        l.created_at,
        %s
        l.inventory_quantity,
        l.inventory_status,
        l.low_stock_threshold,
        l.inventory_last_updated_at,
        l.category_id,
        l.public_id,
        l.listing_category,
        l.listing_subcategory,
        l.pickup_enabled,
        l.local_delivery_enabled,
        l.delivery_fee_cents,
        l.use_business_delivery_defaults,
        l.photo_variants,
        l.is_internal,
        l.cover_image_id,
        l.is_seeded,
        b.is_seeded AS business_is_seeded,
        l.listing_category_id,
        l.business_entity_id
      FROM public.listings l
      JOIN public.businesses b
        ON b.id = l.business_entity_id
        OR (l.business_entity_id IS NULL AND b.owner_user_id = l.business_id)
      WHERE 1=1
        %s
        %s
        AND COALESCE(l.admin_hidden, false) = false
        AND COALESCE(l.is_internal, false) = false
        AND COALESCE(l.is_test, false) = false
        AND COALESCE(b.is_internal, false) = false
        AND b.verification_status IN ('auto_verified', 'manually_verified')
    $sql$,
    select_is_test_column,
    where_status,
    where_is_published
  );
END $$;

ALTER VIEW public.public_listings_v SET (security_invoker = true);
GRANT SELECT ON TABLE public.public_listings_v TO anon, authenticated;

COMMENT ON VIEW public.public_listings_v IS
  'Public listing surface using centralized visibility rules. Transitional ownership supports listings.business_entity_id first, with legacy listings.business_id owner-user fallback.';
