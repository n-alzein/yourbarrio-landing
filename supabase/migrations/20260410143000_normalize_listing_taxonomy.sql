SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS public.listing_taxonomy_legacy_archive (
  listing_id uuid PRIMARY KEY,
  legacy_category text,
  legacy_listing_category text,
  legacy_category_id uuid,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archive_reason text NOT NULL DEFAULT 'listing_taxonomy_normalization'
);

CREATE INDEX IF NOT EXISTS listings_category_slug_idx
  ON public.listings (category);

WITH current_values AS (
  SELECT
    l.id,
    l.category AS legacy_category,
    l.listing_category AS legacy_listing_category,
    l.category_id AS legacy_category_id,
    COALESCE(
      NULLIF(trim(l.listing_category), ''),
      NULLIF(trim(l.category), ''),
      NULLIF(trim(bc.slug), ''),
      NULLIF(trim(bc.name), '')
    ) AS raw_category_value
  FROM public.listings l
  LEFT JOIN public.business_categories bc
    ON bc.id = l.category_id
),
normalized AS (
  SELECT
    cv.*,
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(COALESCE(cv.raw_category_value, '')), '&', 'and', 'g'),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '(^-+)|(-+$)',
      '',
      'g'
    ) AS normalized_value
  FROM current_values cv
),
mapped AS (
  SELECT
    n.*,
    CASE
      WHEN n.normalized_value IN ('clothing-fashion', 'clothing', 'clothing-and-accessories', 'shoes') THEN 'clothing-fashion'
      WHEN n.normalized_value IN ('beauty-personal-care', 'beauty', 'health-and-beauty') THEN 'beauty-personal-care'
      WHEN n.normalized_value IN ('home-decor', 'home-and-kitchen', 'furniture', 'bedding-and-bath') THEN 'home-decor'
      WHEN n.normalized_value IN ('jewelry-accessories', 'jewelry-and-watches', 'accessory', 'accessories') THEN 'jewelry-accessories'
      WHEN n.normalized_value IN ('books-stationery', 'books', 'books-and-media', 'office-and-school') THEN 'books-stationery'
      WHEN n.normalized_value IN (
        'electronics-tech',
        'electronics',
        'computers-and-accessories',
        'mobile-and-accessories',
        'smart-home',
        'tech-and-electronics',
        'video-games'
      ) THEN 'electronics-tech'
      WHEN n.normalized_value IN ('flowers-plants', 'flowers', 'garden-and-outdoor') THEN 'flowers-plants'
      WHEN n.normalized_value IN (
        'art-handmade',
        'arts-and-crafts',
        'handmade-and-artisan',
        'arts-and-entertainment',
        'photography',
        'music-and-instruments'
      ) THEN 'art-handmade'
      WHEN n.normalized_value IN ('home-goods-appliances', 'tools-and-home-improvement') THEN 'home-goods-appliances'
      WHEN n.normalized_value IN ('toys-games', 'toys-and-games') THEN 'toys-games'
      WHEN n.normalized_value IN ('sports-outdoors', 'sports-and-outdoors', 'sports-and-recreation', 'fitness-and-wellness') THEN 'sports-outdoors'
      ELSE 'other'
    END AS canonical_slug,
    CASE
      WHEN n.normalized_value IN ('clothing-fashion', 'clothing', 'clothing-and-accessories', 'shoes') THEN 'Clothing & Fashion'
      WHEN n.normalized_value IN ('beauty-personal-care', 'beauty', 'health-and-beauty') THEN 'Beauty & Personal Care'
      WHEN n.normalized_value IN ('home-decor', 'home-and-kitchen', 'furniture', 'bedding-and-bath') THEN 'Home & Decor'
      WHEN n.normalized_value IN ('jewelry-accessories', 'jewelry-and-watches', 'accessory', 'accessories') THEN 'Jewelry & Accessories'
      WHEN n.normalized_value IN ('books-stationery', 'books', 'books-and-media', 'office-and-school') THEN 'Books & Stationery'
      WHEN n.normalized_value IN (
        'electronics-tech',
        'electronics',
        'computers-and-accessories',
        'mobile-and-accessories',
        'smart-home',
        'tech-and-electronics',
        'video-games'
      ) THEN 'Electronics & Tech'
      WHEN n.normalized_value IN ('flowers-plants', 'flowers', 'garden-and-outdoor') THEN 'Flowers & Plants'
      WHEN n.normalized_value IN (
        'art-handmade',
        'arts-and-crafts',
        'handmade-and-artisan',
        'arts-and-entertainment',
        'photography',
        'music-and-instruments'
      ) THEN 'Art & Handmade'
      WHEN n.normalized_value IN ('home-goods-appliances', 'tools-and-home-improvement') THEN 'Home Goods & Appliances'
      WHEN n.normalized_value IN ('toys-games', 'toys-and-games') THEN 'Toys & Games'
      WHEN n.normalized_value IN ('sports-outdoors', 'sports-and-outdoors', 'sports-and-recreation', 'fitness-and-wellness') THEN 'Sports & Outdoors'
      ELSE 'Other'
    END AS canonical_label
  FROM normalized n
)
INSERT INTO public.listing_taxonomy_legacy_archive (
  listing_id,
  legacy_category,
  legacy_listing_category,
  legacy_category_id,
  archive_reason
)
SELECT
  m.id,
  m.legacy_category,
  m.legacy_listing_category,
  m.legacy_category_id,
  'listing_taxonomy_normalization'
FROM mapped m
WHERE
  m.legacy_category IS DISTINCT FROM m.canonical_slug
  OR m.legacy_listing_category IS DISTINCT FROM m.canonical_label
  OR m.legacy_category_id IS NOT NULL
ON CONFLICT (listing_id) DO UPDATE
SET legacy_category = EXCLUDED.legacy_category,
    legacy_listing_category = EXCLUDED.legacy_listing_category,
    legacy_category_id = EXCLUDED.legacy_category_id,
    archived_at = now(),
    archive_reason = EXCLUDED.archive_reason;

WITH current_values AS (
  SELECT
    l.id,
    COALESCE(
      NULLIF(trim(l.listing_category), ''),
      NULLIF(trim(l.category), ''),
      NULLIF(trim(bc.slug), ''),
      NULLIF(trim(bc.name), '')
    ) AS raw_category_value
  FROM public.listings l
  LEFT JOIN public.business_categories bc
    ON bc.id = l.category_id
),
normalized AS (
  SELECT
    cv.id,
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(COALESCE(cv.raw_category_value, '')), '&', 'and', 'g'),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '(^-+)|(-+$)',
      '',
      'g'
    ) AS normalized_value
  FROM current_values cv
),
mapped AS (
  SELECT
    n.id,
    CASE
      WHEN n.normalized_value IN ('clothing-fashion', 'clothing', 'clothing-and-accessories', 'shoes') THEN 'clothing-fashion'
      WHEN n.normalized_value IN ('beauty-personal-care', 'beauty', 'health-and-beauty') THEN 'beauty-personal-care'
      WHEN n.normalized_value IN ('home-decor', 'home-and-kitchen', 'furniture', 'bedding-and-bath') THEN 'home-decor'
      WHEN n.normalized_value IN ('jewelry-accessories', 'jewelry-and-watches', 'accessory', 'accessories') THEN 'jewelry-accessories'
      WHEN n.normalized_value IN ('books-stationery', 'books', 'books-and-media', 'office-and-school') THEN 'books-stationery'
      WHEN n.normalized_value IN (
        'electronics-tech',
        'electronics',
        'computers-and-accessories',
        'mobile-and-accessories',
        'smart-home',
        'tech-and-electronics',
        'video-games'
      ) THEN 'electronics-tech'
      WHEN n.normalized_value IN ('flowers-plants', 'flowers', 'garden-and-outdoor') THEN 'flowers-plants'
      WHEN n.normalized_value IN (
        'art-handmade',
        'arts-and-crafts',
        'handmade-and-artisan',
        'arts-and-entertainment',
        'photography',
        'music-and-instruments'
      ) THEN 'art-handmade'
      WHEN n.normalized_value IN ('home-goods-appliances', 'tools-and-home-improvement') THEN 'home-goods-appliances'
      WHEN n.normalized_value IN ('toys-games', 'toys-and-games') THEN 'toys-games'
      WHEN n.normalized_value IN ('sports-outdoors', 'sports-and-outdoors', 'sports-and-recreation', 'fitness-and-wellness') THEN 'sports-outdoors'
      ELSE 'other'
    END AS canonical_slug,
    CASE
      WHEN n.normalized_value IN ('clothing-fashion', 'clothing', 'clothing-and-accessories', 'shoes') THEN 'Clothing & Fashion'
      WHEN n.normalized_value IN ('beauty-personal-care', 'beauty', 'health-and-beauty') THEN 'Beauty & Personal Care'
      WHEN n.normalized_value IN ('home-decor', 'home-and-kitchen', 'furniture', 'bedding-and-bath') THEN 'Home & Decor'
      WHEN n.normalized_value IN ('jewelry-accessories', 'jewelry-and-watches', 'accessory', 'accessories') THEN 'Jewelry & Accessories'
      WHEN n.normalized_value IN ('books-stationery', 'books', 'books-and-media', 'office-and-school') THEN 'Books & Stationery'
      WHEN n.normalized_value IN (
        'electronics-tech',
        'electronics',
        'computers-and-accessories',
        'mobile-and-accessories',
        'smart-home',
        'tech-and-electronics',
        'video-games'
      ) THEN 'Electronics & Tech'
      WHEN n.normalized_value IN ('flowers-plants', 'flowers', 'garden-and-outdoor') THEN 'Flowers & Plants'
      WHEN n.normalized_value IN (
        'art-handmade',
        'arts-and-crafts',
        'handmade-and-artisan',
        'arts-and-entertainment',
        'photography',
        'music-and-instruments'
      ) THEN 'Art & Handmade'
      WHEN n.normalized_value IN ('home-goods-appliances', 'tools-and-home-improvement') THEN 'Home Goods & Appliances'
      WHEN n.normalized_value IN ('toys-games', 'toys-and-games') THEN 'Toys & Games'
      WHEN n.normalized_value IN ('sports-outdoors', 'sports-and-outdoors', 'sports-and-recreation', 'fitness-and-wellness') THEN 'Sports & Outdoors'
      ELSE 'Other'
    END AS canonical_label
  FROM normalized n
)
UPDATE public.listings l
SET category = mapped.canonical_slug,
    listing_category = mapped.canonical_label,
    category_id = NULL
FROM mapped
WHERE l.id = mapped.id
  AND (
    l.category IS DISTINCT FROM mapped.canonical_slug
    OR l.listing_category IS DISTINCT FROM mapped.canonical_label
    OR l.category_id IS NOT NULL
  );

-- Verification queries for manual checks:
-- 1. Canonical listing taxonomy counts
-- SELECT category, listing_category, COUNT(*)
-- FROM public.listings
-- GROUP BY category, listing_category
-- ORDER BY category;
--
-- 2. Rows normalized to Other
-- SELECT id, title, category, listing_category
-- FROM public.listings
-- WHERE category = 'other'
-- ORDER BY created_at DESC NULLS LAST;
--
-- 3. Listings still carrying a category_id
-- SELECT id, title, category_id
-- FROM public.listings
-- WHERE category_id IS NOT NULL;
