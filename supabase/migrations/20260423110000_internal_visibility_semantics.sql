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

DROP FUNCTION IF EXISTS public.admin_list_accounts(
  text,
  boolean,
  text,
  integer,
  integer
);

CREATE OR REPLACE FUNCTION public.viewer_can_see_internal_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND COALESCE(u.is_internal, false) = true
  );
$$;

REVOKE ALL ON FUNCTION public.viewer_can_see_internal_content() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.viewer_can_see_internal_content() TO anon, authenticated;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS is_internal boolean;

UPDATE public.listings
SET is_internal = false
WHERE is_internal IS NULL;

ALTER TABLE public.listings
  ALTER COLUMN is_internal SET DEFAULT false,
  ALTER COLUMN is_internal SET NOT NULL;

DROP POLICY IF EXISTS "Public can read verified businesses" ON public.businesses;
CREATE POLICY "Public can read verified businesses"
  ON public.businesses
  FOR SELECT
  TO anon, authenticated
  USING (
    verification_status IN ('auto_verified', 'manually_verified')
    AND (
      COALESCE(is_internal, false) = false
      OR public.viewer_can_see_internal_content()
    )
  );

DROP POLICY IF EXISTS "Public can read verified listings" ON public.listings;

DO $$
DECLARE
  has_is_published boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'listings'
      AND c.column_name = 'is_published'
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
            WHERE b.owner_user_id = listings.business_id
              AND b.verification_status IN ('auto_verified', 'manually_verified')
              AND (
                (
                  COALESCE(listings.is_internal, false) = false
                  AND COALESCE(b.is_internal, false) = false
                )
                OR public.viewer_can_see_internal_content()
              )
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
            WHERE b.owner_user_id = listings.business_id
              AND b.verification_status IN ('auto_verified', 'manually_verified')
              AND (
                (
                  COALESCE(listings.is_internal, false) = false
                  AND COALESCE(b.is_internal, false) = false
                )
                OR public.viewer_can_see_internal_content()
              )
          )
        )
    $sql$;
  END IF;
END $$;

DO $$
DECLARE
  has_is_published boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'listings'
      AND c.column_name = 'is_published'
  ) INTO has_is_published;

  IF has_is_published THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.public_listings_v AS
      SELECT l.*
      FROM public.listings l
      JOIN public.businesses b
        ON b.owner_user_id = l.business_id
      WHERE l.is_published = true
        AND b.verification_status IN ('auto_verified', 'manually_verified')
        AND (
          (
            COALESCE(l.is_internal, false) = false
            AND COALESCE(b.is_internal, false) = false
          )
          OR public.viewer_can_see_internal_content()
        )
    $sql$;
  ELSE
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.public_listings_v AS
      SELECT l.*
      FROM public.listings l
      JOIN public.businesses b
        ON b.owner_user_id = l.business_id
      WHERE b.verification_status IN ('auto_verified', 'manually_verified')
        AND (
          (
            COALESCE(l.is_internal, false) = false
            AND COALESCE(b.is_internal, false) = false
          )
          OR public.viewer_can_see_internal_content()
        )
    $sql$;
  END IF;
END $$;

GRANT SELECT ON TABLE public.public_listings_v TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_accounts(
  p_role text DEFAULT 'all',
  p_internal boolean DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_from integer DEFAULT 0,
  p_to integer DEFAULT 19
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  business_name text,
  role text,
  is_internal boolean,
  city text,
  created_at timestamptz,
  admin_role_keys text[],
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(NULLIF(lower(trim(p_role)), ''), 'all');
  v_from integer := GREATEST(COALESCE(p_from, 0), 0);
  v_to integer := GREATEST(COALESCE(p_to, 19), 0);
  v_limit integer := GREATEST(v_to - v_from + 1, 0);
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF v_role NOT IN ('all', 'customer', 'business', 'admin') THEN
    v_role := 'all';
  END IF;

  RETURN QUERY
  WITH role_members AS (
    SELECT
      arm.user_id,
      array_agg(DISTINCT arm.role_key ORDER BY arm.role_key)::text[] AS role_keys
    FROM public.admin_role_members arm
    GROUP BY arm.user_id
  ),
  base AS (
    SELECT
      u.id::uuid AS id,
      u.email::text AS email,
      u.full_name::text AS full_name,
      u.phone::text AS phone,
      u.business_name::text AS business_name,
      COALESCE(NULLIF(lower(u.role), ''), 'customer')::text AS role,
      CASE
        WHEN COALESCE(NULLIF(lower(u.role), ''), 'customer') = 'business'
          THEN COALESCE(b.is_internal, false)
        ELSE COALESCE((to_jsonb(u) ->> 'is_internal')::boolean, false)
      END AS is_internal,
      u.city::text AS city,
      u.created_at::timestamptz AS created_at,
      COALESCE(rm.role_keys, ARRAY[]::text[]) AS admin_role_keys,
      (
        COALESCE(NULLIF(lower(u.role), ''), 'customer') = 'admin'
        OR cardinality(COALESCE(rm.role_keys, ARRAY[]::text[])) > 0
      ) AS account_is_admin
    FROM public.users u
    LEFT JOIN role_members rm
      ON rm.user_id = u.id
    LEFT JOIN public.businesses b
      ON b.owner_user_id = u.id
  ),
  filtered AS (
    SELECT *
    FROM base b
    WHERE
      CASE
        WHEN v_role = 'business' THEN b.role = 'business' AND b.account_is_admin = false
        WHEN v_role = 'customer' THEN b.role IN ('customer', 'user') AND b.account_is_admin = false
        WHEN v_role = 'admin' THEN b.account_is_admin = true
        ELSE true
      END
      AND (
        p_internal IS NULL
        OR b.is_internal = p_internal
      )
      AND (
        p_q IS NULL
        OR btrim(p_q) = ''
        OR (
          COALESCE(b.full_name, '') ILIKE '%' || p_q || '%'
          OR COALESCE(b.email, '') ILIKE '%' || p_q || '%'
          OR COALESCE(b.phone, '') ILIKE '%' || p_q || '%'
          OR COALESCE(b.business_name, '') ILIKE '%' || p_q || '%'
        )
      )
  ),
  counted AS (
    SELECT
      f.*,
      count(*) OVER () AS total_count
    FROM filtered f
  )
  SELECT
    c.id,
    c.email,
    c.full_name,
    c.phone,
    c.business_name,
    c.role,
    c.is_internal,
    c.city,
    c.created_at,
    c.admin_role_keys,
    c.total_count
  FROM counted c
  ORDER BY c.created_at DESC NULLS LAST
  OFFSET v_from
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_accounts(text, boolean, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts(text, boolean, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_business_from_onboarding(p_payload jsonb)
RETURNS TABLE (
  business_id uuid,
  public_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := NULLIF(trim(COALESCE(p_payload->>'name', '')), '');
  v_category text := NULLIF(trim(COALESCE(p_payload->>'category', '')), '');
  v_description text := NULLIF(trim(COALESCE(p_payload->>'description', '')), '');
  v_address text := NULLIF(trim(COALESCE(p_payload->>'address', '')), '');
  v_address_2 text := NULLIF(trim(COALESCE(p_payload->>'address_2', '')), '');
  v_city text := NULLIF(trim(COALESCE(p_payload->>'city', '')), '');
  v_state text := upper(NULLIF(trim(COALESCE(p_payload->>'state', '')), ''));
  v_postal_code text := NULLIF(trim(COALESCE(p_payload->>'postal_code', '')), '');
  v_phone text := NULLIF(trim(COALESCE(p_payload->>'phone', '')), '');
  v_website text := NULLIF(trim(COALESCE(p_payload->>'website', '')), '');
  v_latitude double precision := NULLIF(p_payload->>'latitude', '')::double precision;
  v_longitude double precision := NULLIF(p_payload->>'longitude', '')::double precision;
  v_user_public_id text;
  v_user_is_internal boolean := false;
  v_business_is_internal boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be authenticated';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;
  IF v_category IS NULL THEN
    RAISE EXCEPTION 'Category is required';
  END IF;
  IF v_address IS NULL OR v_city IS NULL OR v_state IS NULL OR v_postal_code IS NULL THEN
    RAISE EXCEPTION 'Address, city, state, and postal code are required';
  END IF;

  SELECT
    u.public_id,
    COALESCE(u.is_internal, false),
    COALESCE(b.is_internal, false)
  INTO v_user_public_id, v_user_is_internal, v_business_is_internal
  FROM public.users u
  LEFT JOIN public.businesses b
    ON b.owner_user_id = u.id
  WHERE u.id = v_uid;

  v_user_public_id := COALESCE(v_user_public_id, public.generate_short_id());

  INSERT INTO public.users (
    id,
    role,
    public_id,
    full_name,
    business_name,
    category,
    description,
    address,
    address_2,
    city,
    state,
    postal_code,
    phone,
    website,
    latitude,
    longitude,
    is_internal
  )
  VALUES (
    v_uid,
    'business',
    v_user_public_id,
    v_name,
    v_name,
    v_category,
    v_description,
    v_address,
    v_address_2,
    v_city,
    v_state,
    v_postal_code,
    v_phone,
    v_website,
    v_latitude,
    v_longitude,
    v_user_is_internal
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'business',
    full_name = EXCLUDED.full_name,
    business_name = EXCLUDED.business_name,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    address = EXCLUDED.address,
    address_2 = EXCLUDED.address_2,
    city = EXCLUDED.city,
    state = EXCLUDED.state,
    postal_code = EXCLUDED.postal_code,
    phone = EXCLUDED.phone,
    website = EXCLUDED.website,
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude;

  INSERT INTO public.businesses (
    owner_user_id,
    public_id,
    business_name,
    category,
    description,
    website,
    phone,
    address,
    address_2,
    city,
    state,
    postal_code,
    latitude,
    longitude,
    is_internal,
    verification_status,
    stripe_connected
  )
  VALUES (
    v_uid,
    v_user_public_id,
    v_name,
    v_category,
    v_description,
    v_website,
    v_phone,
    v_address,
    v_address_2,
    v_city,
    v_state,
    v_postal_code,
    v_latitude,
    v_longitude,
    v_business_is_internal,
    'pending',
    false
  )
  ON CONFLICT (owner_user_id) DO UPDATE SET
    owner_user_id = EXCLUDED.owner_user_id
  RETURNING businesses.id, businesses.public_id
  INTO business_id, public_id;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_business_from_onboarding(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_from_onboarding(jsonb) TO authenticated;
