SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.business_categories
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DO $$
DECLARE
  rec record;
  target_id uuid;
BEGIN
  FOR rec IN
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
    ) AS launch(name, slug)
  LOOP
    SELECT bc.id
    INTO target_id
    FROM public.business_categories bc
    WHERE bc.slug = rec.slug OR bc.name = rec.name
    ORDER BY CASE WHEN bc.slug = rec.slug THEN 0 ELSE 1 END
    LIMIT 1;

    IF target_id IS NULL THEN
      INSERT INTO public.business_categories (name, slug, is_active)
      VALUES (rec.name, rec.slug, true);
    ELSE
      UPDATE public.business_categories
      SET name = rec.name,
          slug = rec.slug,
          is_active = true,
          updated_at = now()
      WHERE id = target_id;
    END IF;
  END LOOP;
END
$$;

WITH launch_map AS (
  SELECT *
  FROM (
    VALUES
      ('Clothing & Fashion', 'clothing-fashion', 'Clothing', 'clothing'),
      ('Clothing & Fashion', 'clothing-fashion', 'Clothing & Accessories', 'clothing-and-accessories'),
      ('Clothing & Fashion', 'clothing-fashion', 'Shoes', 'shoes'),
      ('Beauty & Personal Care', 'beauty-personal-care', 'Health & Beauty', 'health-and-beauty'),
      ('Home & Decor', 'home-decor', 'Home & Decor', 'home-decor'),
      ('Jewelry & Accessories', 'jewelry-accessories', 'Jewelry & Watches', 'jewelry-and-watches'),
      ('Gifts & Crafts', 'gifts-crafts', 'Gifts & Specialty', 'gifts-specialty'),
      ('Gifts & Crafts', 'gifts-crafts', 'Arts & Crafts', 'arts-and-crafts'),
      ('Art & Handmade', 'art-handmade', 'Handmade & Artisan', 'handmade-and-artisan'),
      ('Books & Stationery', 'books-stationery', 'Books & Media', 'books-and-media'),
      ('Books & Stationery', 'books-stationery', 'Office & School', 'office-and-school'),
      ('Flowers & Plants', 'flowers-plants', 'Flowers & Plants', 'flowers-plants')
  ) AS t(canonical_name, canonical_slug, alias_name, alias_slug)
),
canonical_rows AS (
  SELECT bc.id AS canonical_id, bc.name AS canonical_name, bc.slug AS canonical_slug
  FROM public.business_categories bc
  WHERE bc.slug IN (
    'clothing-fashion',
    'beauty-personal-care',
    'home-decor',
    'jewelry-accessories',
    'gifts-crafts',
    'flowers-plants',
    'art-handmade',
    'books-stationery'
  )
),
alias_rows AS (
  SELECT DISTINCT
    legacy.id AS legacy_id,
    canonical.canonical_id,
    canonical.canonical_name,
    canonical.canonical_slug,
    legacy.name AS legacy_name,
    legacy.slug AS legacy_slug
  FROM launch_map map
  JOIN canonical_rows canonical
    ON canonical.canonical_slug = map.canonical_slug
  JOIN public.business_categories legacy
    ON (legacy.name = map.alias_name OR legacy.slug = map.alias_slug)
  WHERE legacy.id <> canonical.canonical_id
)
UPDATE public.listings l
SET category_id = alias_rows.canonical_id,
    category = alias_rows.canonical_name,
    listing_category = COALESCE(alias_rows.canonical_name, l.listing_category)
FROM alias_rows
WHERE l.category_id = alias_rows.legacy_id;

WITH launch_map AS (
  SELECT *
  FROM (
    VALUES
      ('Clothing & Fashion', 'clothing-fashion', 'Clothing', 'clothing'),
      ('Clothing & Fashion', 'clothing-fashion', 'Clothing & Accessories', 'clothing-and-accessories'),
      ('Clothing & Fashion', 'clothing-fashion', 'Shoes', 'shoes'),
      ('Beauty & Personal Care', 'beauty-personal-care', 'Health & Beauty', 'health-and-beauty'),
      ('Home & Decor', 'home-decor', 'Home & Decor', 'home-decor'),
      ('Jewelry & Accessories', 'jewelry-accessories', 'Jewelry & Watches', 'jewelry-and-watches'),
      ('Gifts & Crafts', 'gifts-crafts', 'Gifts & Specialty', 'gifts-specialty'),
      ('Gifts & Crafts', 'gifts-crafts', 'Arts & Crafts', 'arts-and-crafts'),
      ('Art & Handmade', 'art-handmade', 'Handmade & Artisan', 'handmade-and-artisan'),
      ('Books & Stationery', 'books-stationery', 'Books & Media', 'books-and-media'),
      ('Books & Stationery', 'books-stationery', 'Office & School', 'office-and-school'),
      ('Flowers & Plants', 'flowers-plants', 'Flowers & Plants', 'flowers-plants')
  ) AS t(canonical_name, canonical_slug, alias_name, alias_slug)
),
canonical_rows AS (
  SELECT bc.id AS canonical_id, bc.name AS canonical_name, bc.slug AS canonical_slug
  FROM public.business_categories bc
  WHERE bc.slug IN (
    'clothing-fashion',
    'beauty-personal-care',
    'home-decor',
    'jewelry-accessories',
    'gifts-crafts',
    'flowers-plants',
    'art-handmade',
    'books-stationery'
  )
)
UPDATE public.listings l
SET category_id = canonical.canonical_id,
    category = canonical.canonical_name,
    listing_category = COALESCE(canonical.canonical_name, l.listing_category)
FROM launch_map map
JOIN canonical_rows canonical
  ON canonical.canonical_slug = map.canonical_slug
WHERE l.category_id IS NULL
  AND (
    l.category = map.alias_name OR
    l.category = map.alias_slug OR
    l.listing_category = map.alias_name OR
    l.listing_category = map.alias_slug OR
    l.category = canonical.canonical_name OR
    l.category = canonical.canonical_slug OR
    l.listing_category = canonical.canonical_name OR
    l.listing_category = canonical.canonical_slug
  );

UPDATE public.business_categories
SET is_active = CASE
  WHEN slug IN (
    'clothing-fashion',
    'beauty-personal-care',
    'home-decor',
    'jewelry-accessories',
    'gifts-crafts',
    'flowers-plants',
    'art-handmade',
    'books-stationery'
  ) THEN true
  ELSE false
END,
updated_at = now();
