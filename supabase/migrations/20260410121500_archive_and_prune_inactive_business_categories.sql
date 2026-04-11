SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS public.business_categories_legacy_archive (
  archived_id uuid PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text NOT NULL DEFAULT 'launch_taxonomy_cleanup'
);

WITH inactive_categories AS (
  SELECT bc.*
  FROM public.business_categories bc
  WHERE bc.is_active = false
),
unreferenced_inactive AS (
  SELECT ic.*
  FROM inactive_categories ic
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.category_id = ic.id
  )
)
INSERT INTO public.business_categories_legacy_archive (
  archived_id,
  name,
  slug,
  is_active,
  created_at,
  updated_at,
  archive_reason
)
SELECT
  ui.id,
  ui.name,
  ui.slug,
  ui.is_active,
  ui.created_at,
  ui.updated_at,
  'launch_taxonomy_cleanup'
FROM unreferenced_inactive ui
ON CONFLICT (archived_id) DO UPDATE
SET name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    is_active = EXCLUDED.is_active,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at,
    archived_at = now(),
    archive_reason = EXCLUDED.archive_reason;

DELETE FROM public.business_categories bc
WHERE bc.is_active = false
  AND EXISTS (
    SELECT 1
    FROM public.business_categories_legacy_archive archive
    WHERE archive.archived_id = bc.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.listings l
    WHERE l.category_id = bc.id
  );

-- Verification queries for manual prod checks:
-- 1. Remaining references to inactive category IDs
-- SELECT l.category_id, bc.name, bc.slug, COUNT(*) AS listing_refs
-- FROM public.listings l
-- JOIN public.business_categories bc ON bc.id = l.category_id
-- WHERE bc.is_active = false
-- GROUP BY l.category_id, bc.name, bc.slug
-- ORDER BY listing_refs DESC;
--
-- 2. Row counts before/after archive and prune
-- SELECT
--   (SELECT COUNT(*) FROM public.business_categories) AS live_count,
--   (SELECT COUNT(*) FROM public.business_categories WHERE is_active = true) AS active_count,
--   (SELECT COUNT(*) FROM public.business_categories_legacy_archive) AS archived_count;
--
-- 3. Final contents of public.business_categories
-- SELECT id, name, slug, is_active
-- FROM public.business_categories
-- ORDER BY is_active DESC, name ASC;
--
-- 4. Confirm only 8 rows remain active
-- SELECT COUNT(*) AS active_launch_categories
-- FROM public.business_categories
-- WHERE is_active = true;
