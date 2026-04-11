SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS public.listings_legacy_cleanup_archive (
  listing_id uuid PRIMARY KEY,
  business_id uuid,
  archived_payload jsonb NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text NOT NULL DEFAULT 'legacy_category_seed_cleanup'
);

WITH launch_category_values AS (
  SELECT *
  FROM (
    VALUES
      ('Clothing & Fashion', 'clothing-fashion'),
      ('Beauty & Personal Care', 'beauty-personal-care'),
      ('Home & Decor', 'home-decor'),
      ('Jewelry & Accessories', 'jewelry-accessories'),
      ('Gifts & Crafts', 'gifts-crafts'),
      ('Flowers & Plants', 'flowers-plants'),
      ('Art & Handmade', 'art-handmade'),
      ('Books & Stationery', 'books-stationery')
  ) AS t(name, slug)
),
legacy_category_values AS (
  SELECT *
  FROM (
    VALUES
      ('Clothing', 'clothing'),
      ('Clothing & Accessories', 'clothing-and-accessories'),
      ('Shoes', 'shoes'),
      ('Health & Beauty', 'health-and-beauty'),
      ('Jewelry & Watches', 'jewelry-and-watches'),
      ('Gifts & Specialty', 'gifts-specialty'),
      ('Arts & Crafts', 'arts-and-crafts'),
      ('Handmade & Artisan', 'handmade-and-artisan'),
      ('Books & Media', 'books-and-media'),
      ('Office & School', 'office-and-school'),
      ('Home Fragrance', 'home-fragrance'),
      ('Home Textiles', 'home-textiles'),
      ('Pantry', 'pantry'),
      ('Accessories', 'accessories'),
      ('Kitchen', 'kitchen')
  ) AS t(name, slug)
),
candidate_fake_listings AS (
  SELECT
    l.*,
    b.business_name,
    b.is_internal,
    bc.name AS category_name_from_fk,
    bc.slug AS category_slug_from_fk,
    bc.is_active AS category_is_active
  FROM public.listings l
  LEFT JOIN public.businesses b
    ON b.owner_user_id = l.business_id
  LEFT JOIN public.business_categories bc
    ON bc.id = l.category_id
  WHERE
    (
      COALESCE(b.is_internal, false) = true
      OR lower(COALESCE(b.business_name, '')) = 'yourbarrio'
      OR lower(COALESCE(l.title, '')) IN (
        'cedar + citrus candle',
        'everyday linen set',
        'heritage coffee kit',
        'market tote bundle',
        'stoneware mug set'
      )
    )
    AND (
      (l.category_id IS NOT NULL AND COALESCE(bc.is_active, false) = false)
      OR EXISTS (
        SELECT 1
        FROM legacy_category_values legacy
        WHERE l.category = legacy.name
           OR l.category = legacy.slug
           OR l.listing_category = legacy.name
           OR l.listing_category = legacy.slug
      )
    )
)
INSERT INTO public.listings_legacy_cleanup_archive (
  listing_id,
  business_id,
  archived_payload,
  archive_reason
)
SELECT
  cfl.id,
  cfl.business_id,
  to_jsonb(cfl),
  'legacy_category_seed_cleanup'
FROM candidate_fake_listings cfl
ON CONFLICT (listing_id) DO UPDATE
SET business_id = EXCLUDED.business_id,
    archived_payload = EXCLUDED.archived_payload,
    archived_at = now(),
    archive_reason = EXCLUDED.archive_reason;

DELETE FROM public.listings l
WHERE EXISTS (
  SELECT 1
  FROM public.listings_legacy_cleanup_archive archive
  WHERE archive.listing_id = l.id
    AND archive.archive_reason = 'legacy_category_seed_cleanup'
);

-- Re-run the inactive category archive/delete pass after removing archived seed/demo listings.
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
  'launch_taxonomy_cleanup_after_listing_cleanup'
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
-- 1. Listings still joined to inactive category IDs
-- SELECT l.id, l.title, l.category_id, bc.name, bc.slug
-- FROM public.listings l
-- JOIN public.business_categories bc ON bc.id = l.category_id
-- WHERE bc.is_active = false
-- ORDER BY l.created_at DESC NULLS LAST;
--
-- 2. Listings with category/category string values outside the 8 launch categories
-- WITH launch_values AS (
--   SELECT *
--   FROM (VALUES
--     ('Clothing & Fashion', 'clothing-fashion'),
--     ('Beauty & Personal Care', 'beauty-personal-care'),
--     ('Home & Decor', 'home-decor'),
--     ('Jewelry & Accessories', 'jewelry-accessories'),
--     ('Gifts & Crafts', 'gifts-crafts'),
--     ('Flowers & Plants', 'flowers-plants'),
--     ('Art & Handmade', 'art-handmade'),
--     ('Books & Stationery', 'books-stationery')
--   ) AS t(name, slug)
-- )
-- SELECT l.id, l.title, l.category, l.listing_category
-- FROM public.listings l
-- WHERE COALESCE(l.category, '') <> ''
--   AND NOT EXISTS (
--     SELECT 1
--     FROM launch_values lv
--     WHERE l.category = lv.name
--        OR l.category = lv.slug
--        OR l.listing_category = lv.name
--        OR l.listing_category = lv.slug
--   )
-- ORDER BY l.created_at DESC NULLS LAST;
--
-- 3. Final active categories
-- SELECT id, name, slug
-- FROM public.business_categories
-- WHERE is_active = true
-- ORDER BY name;
--
-- 4. Remaining inactive categories
-- SELECT id, name, slug
-- FROM public.business_categories
-- WHERE is_active = false
-- ORDER BY name;
--
-- 5. Inactive rows that are still not safe to delete
-- SELECT bc.id, bc.name, bc.slug, COUNT(l.id) AS listing_refs
-- FROM public.business_categories bc
-- LEFT JOIN public.listings l ON l.category_id = bc.id
-- WHERE bc.is_active = false
-- GROUP BY bc.id, bc.name, bc.slug
-- HAVING COUNT(l.id) > 0
-- ORDER BY listing_refs DESC, bc.name;
