-- Listing variants RLS verification
-- Run after the migration is present in the database, before any broader rollout.
-- This script uses existing rows only and does not mutate live data.

-- 1. Structural checks
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'listing_attributes',
    'listing_attribute_values',
    'listing_variants',
    'listing_variant_options'
  )
ORDER BY c.relname;

SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'listing_attributes',
    'listing_attribute_values',
    'listing_variants',
    'listing_variant_options'
  )
ORDER BY tablename, policyname;

SELECT
  p.proname,
  p.prosecdef AS is_security_definer,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'can_read_listing_variant_source',
    'can_manage_listing_variant_source',
    'replace_listing_option_tree'
  )
ORDER BY p.proname;

SELECT
  conname,
  contype,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN (
  'cart_items_cart_listing_key',
  'cart_items_variant_id_fkey',
  'order_items_variant_id_fkey'
)
ORDER BY conname;

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'cart_items_cart_listing_without_variant_unique_idx',
    'cart_items_cart_listing_variant_unique_idx'
  )
ORDER BY indexname;

BEGIN;

CREATE TEMP TABLE listing_variant_rls_candidates AS
WITH public_listing AS (
  SELECT l.id, l.business_id
  FROM public.public_listings_v l
  LIMIT 1
),
private_listing AS (
  SELECT l.id, l.business_id
  FROM public.listings l
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.public_listings_v pl
    WHERE pl.id = l.id
  )
  LIMIT 1
),
admin_readonly_user AS (
  SELECT arm.user_id
  FROM public.admin_role_members arm
  JOIN public.admin_roles ar
    ON ar.role_key = arm.role_key
  WHERE ar.role_rank >= public.admin_role_rank('admin_readonly')
  ORDER BY ar.role_rank DESC, arm.created_at ASC
  LIMIT 1
),
admin_ops_user AS (
  SELECT arm.user_id
  FROM public.admin_role_members arm
  JOIN public.admin_roles ar
    ON ar.role_key = arm.role_key
  WHERE ar.role_rank >= public.admin_role_rank('admin_ops')
  ORDER BY ar.role_rank DESC, arm.created_at ASC
  LIMIT 1
)
SELECT
  (SELECT id FROM public_listing) AS public_listing_id,
  (SELECT business_id FROM public_listing) AS public_listing_owner_id,
  (SELECT id FROM private_listing) AS private_listing_id,
  (SELECT business_id FROM private_listing) AS private_listing_owner_id,
  (SELECT user_id FROM admin_readonly_user) AS admin_readonly_user_id,
  (SELECT user_id FROM admin_ops_user) AS admin_ops_user_id,
  gen_random_uuid() AS unrelated_business_user_id;

CREATE TEMP TABLE listing_variant_rls_excluded_candidates (
  reason text PRIMARY KEY,
  listing_id uuid,
  business_id uuid
);

CREATE TEMP TABLE listing_variant_rls_expected_exclusions (
  reason text PRIMARY KEY
);

INSERT INTO listing_variant_rls_expected_exclusions (reason)
VALUES
  ('draft_listing'),
  ('inactive_or_hidden_listing'),
  ('deleted_or_archived_listing'),
  ('unverified_business_listing');

GRANT SELECT ON TABLE listing_variant_rls_candidates TO anon, authenticated;
GRANT SELECT ON TABLE listing_variant_rls_excluded_candidates TO anon, authenticated;
GRANT SELECT ON TABLE listing_variant_rls_expected_exclusions TO anon, authenticated;

DO $$
DECLARE
  has_is_published boolean;
  has_is_active boolean;
  has_deleted_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'is_published'
  )
  INTO has_is_published;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'is_active'
  )
  INTO has_is_active;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'deleted_at'
  )
  INTO has_deleted_at;

  IF has_is_published THEN
    EXECUTE $sql$
      INSERT INTO listing_variant_rls_excluded_candidates (reason, listing_id, business_id)
      SELECT
        'draft_listing',
        l.id,
        l.business_id
      FROM public.listings l
      WHERE COALESCE(l.is_published, false) = false
        AND NOT EXISTS (
          SELECT 1
          FROM public.public_listings_v pl
          WHERE pl.id = l.id
        )
      LIMIT 1
      ON CONFLICT (reason) DO NOTHING
    $sql$;
  END IF;

  IF has_is_active THEN
    EXECUTE $sql$
      INSERT INTO listing_variant_rls_excluded_candidates (reason, listing_id, business_id)
      SELECT
        'inactive_or_hidden_listing',
        l.id,
        l.business_id
      FROM public.listings l
      WHERE COALESCE(l.is_active, true) = false
        AND NOT EXISTS (
          SELECT 1
          FROM public.public_listings_v pl
          WHERE pl.id = l.id
        )
      LIMIT 1
      ON CONFLICT (reason) DO NOTHING
    $sql$;
  END IF;

  IF has_deleted_at THEN
    EXECUTE $sql$
      INSERT INTO listing_variant_rls_excluded_candidates (reason, listing_id, business_id)
      SELECT
        'deleted_or_archived_listing',
        l.id,
        l.business_id
      FROM public.listings l
      WHERE l.deleted_at IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.public_listings_v pl
          WHERE pl.id = l.id
        )
      LIMIT 1
      ON CONFLICT (reason) DO NOTHING
    $sql$;
  END IF;

  INSERT INTO listing_variant_rls_excluded_candidates (reason, listing_id, business_id)
  SELECT
    'unverified_business_listing',
    l.id,
    l.business_id
  FROM public.listings l
  JOIN public.businesses b
    ON b.owner_user_id = l.business_id
  WHERE b.verification_status NOT IN ('auto_verified', 'manually_verified')
    AND NOT EXISTS (
      SELECT 1
      FROM public.public_listings_v pl
      WHERE pl.id = l.id
    )
  LIMIT 1
  ON CONFLICT (reason) DO NOTHING;
END $$;

-- 2. Anonymous reads should match listing visibility.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.role', 'anon', true);
SELECT set_config('request.jwt.claim.sub', '', true);

CREATE TEMP TABLE anon_visible_public_listing_ids AS
SELECT pl.id
FROM public.public_listings_v pl;

CREATE TEMP TABLE anon_visible_variant_listing_ids AS
SELECT DISTINCT la.listing_id
FROM public.listing_attributes la
UNION
SELECT DISTINCT lv.listing_id
FROM public.listing_variants lv;

CREATE TEMP TABLE anon_helper_results AS
SELECT
  c.public_listing_id,
  c.private_listing_id,
  public.can_read_listing_variant_source(c.public_listing_id) AS can_read_public_listing_source,
  public.can_read_listing_variant_source(c.private_listing_id) AS can_read_private_listing_source
FROM listing_variant_rls_candidates c;

CREATE TEMP TABLE anon_excluded_helper_results AS
SELECT
  er.reason,
  ec.listing_id,
  (ec.listing_id IS NOT NULL) AS candidate_found,
  public.can_read_listing_variant_source(ec.listing_id) AS helper_allows_read,
  EXISTS (
    SELECT 1
    FROM public.listing_attributes la
    WHERE la.listing_id = ec.listing_id
  ) AS anon_can_read_attributes,
  EXISTS (
    SELECT 1
    FROM public.listing_variants lv
    WHERE lv.listing_id = ec.listing_id
  ) AS anon_can_read_variants
FROM listing_variant_rls_expected_exclusions er
LEFT JOIN listing_variant_rls_excluded_candidates ec
  ON ec.reason = er.reason;

RESET ROLE;

SELECT
  'anon_variant_rows_not_visible_via_public_view' AS check_name,
  COUNT(*) AS offending_listing_count
FROM (
  SELECT av.listing_id
  FROM anon_visible_variant_listing_ids av
  EXCEPT
  SELECT ap.id
  FROM anon_visible_public_listing_ids ap
) s;

SELECT * FROM anon_helper_results;
SELECT * FROM anon_excluded_helper_results ORDER BY reason;

-- 3. Owner access on their own listing source.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  COALESCE(
    (SELECT private_listing_owner_id::text FROM listing_variant_rls_candidates),
    (SELECT public_listing_owner_id::text FROM listing_variant_rls_candidates),
    gen_random_uuid()::text
  ),
  true
);

CREATE TEMP TABLE owner_helper_results AS
SELECT
  c.public_listing_id,
  c.private_listing_id,
  public.can_read_listing_variant_source(c.public_listing_id) AS can_read_public_listing_source,
  public.can_read_listing_variant_source(c.private_listing_id) AS can_read_private_listing_source,
  public.can_manage_listing_variant_source(c.public_listing_id) AS can_manage_public_listing_source,
  public.can_manage_listing_variant_source(c.private_listing_id) AS can_manage_private_listing_source
FROM listing_variant_rls_candidates c;

RESET ROLE;

SELECT * FROM owner_helper_results;

-- 4. Unrelated business cannot manage someone else’s listing source.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT unrelated_business_user_id::text FROM listing_variant_rls_candidates),
  true
);

CREATE TEMP TABLE unrelated_business_helper_results AS
SELECT
  c.public_listing_id,
  c.private_listing_id,
  public.can_manage_listing_variant_source(c.public_listing_id) AS can_manage_public_listing_source,
  public.can_manage_listing_variant_source(c.private_listing_id) AS can_manage_private_listing_source
FROM listing_variant_rls_candidates c;

RESET ROLE;

SELECT * FROM unrelated_business_helper_results;

-- 5. Admin readonly and admin ops helper checks, when those roles exist.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  COALESCE(
    (SELECT admin_readonly_user_id::text FROM listing_variant_rls_candidates),
    gen_random_uuid()::text
  ),
  true
);

CREATE TEMP TABLE admin_readonly_helper_results AS
SELECT
  c.admin_readonly_user_id,
  c.public_listing_id,
  c.private_listing_id,
  public.can_read_listing_variant_source(c.public_listing_id) AS can_read_public_listing_source,
  public.can_read_listing_variant_source(c.private_listing_id) AS can_read_private_listing_source,
  public.can_manage_listing_variant_source(c.public_listing_id) AS can_manage_public_listing_source,
  public.can_manage_listing_variant_source(c.private_listing_id) AS can_manage_private_listing_source
FROM listing_variant_rls_candidates c;

RESET ROLE;

SELECT * FROM admin_readonly_helper_results;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  COALESCE(
    (SELECT admin_ops_user_id::text FROM listing_variant_rls_candidates),
    gen_random_uuid()::text
  ),
  true
);

CREATE TEMP TABLE admin_ops_helper_results AS
SELECT
  c.admin_ops_user_id,
  c.public_listing_id,
  c.private_listing_id,
  public.can_read_listing_variant_source(c.public_listing_id) AS can_read_public_listing_source,
  public.can_read_listing_variant_source(c.private_listing_id) AS can_read_private_listing_source,
  public.can_manage_listing_variant_source(c.public_listing_id) AS can_manage_public_listing_source,
  public.can_manage_listing_variant_source(c.private_listing_id) AS can_manage_private_listing_source
FROM listing_variant_rls_candidates c;

RESET ROLE;

SELECT * FROM admin_ops_helper_results;

ROLLBACK;
