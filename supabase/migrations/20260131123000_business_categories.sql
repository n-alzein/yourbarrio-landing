-- Normalize listing categories into business_categories with FK on listings

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public read business categories'
  ) THEN
    CREATE POLICY "Public read business categories"
      ON public.business_categories FOR SELECT USING (true);
  END IF;
END$$;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS category_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'listings_category_id_fkey'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.business_categories(id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS listings_category_id_idx
  ON public.listings (category_id);

INSERT INTO public.business_categories (name, slug)
VALUES
  ('Arts & Crafts', 'arts-and-crafts'),
  ('Arts & Entertainment', 'arts-and-entertainment'),
  ('Automotive', 'automotive'),
  ('Baby & Maternity', 'baby-and-maternity'),
  ('Bedding & Bath', 'bedding-and-bath'),
  ('Books & Media', 'books-and-media'),
  ('Clothing & Accessories', 'clothing-and-accessories'),
  ('Computers & Accessories', 'computers-and-accessories'),
  ('Fitness & Wellness', 'fitness-and-wellness'),
  ('Food & Drink', 'food-and-drink'),
  ('Furniture', 'furniture'),
  ('Garden & Outdoor', 'garden-and-outdoor'),
  ('Grocery & Gourmet', 'grocery-and-gourmet'),
  ('Handmade & Artisan', 'handmade-and-artisan'),
  ('Health & Beauty', 'health-and-beauty'),
  ('Health & Household', 'health-and-household'),
  ('Home & Kitchen', 'home-and-kitchen'),
  ('Home Services', 'home-services'),
  ('Industrial & Scientific', 'industrial-and-scientific'),
  ('Jewelry & Watches', 'jewelry-and-watches'),
  ('Kids & Family', 'kids-and-family'),
  ('Mobile & Accessories', 'mobile-and-accessories'),
  ('Music & Instruments', 'music-and-instruments'),
  ('Office & School', 'office-and-school'),
  ('Pets & Animals', 'pets-and-animals'),
  ('Photography', 'photography'),
  ('Professional Services', 'professional-services'),
  ('Shoes', 'shoes'),
  ('Smart Home', 'smart-home'),
  ('Sports & Outdoors', 'sports-and-outdoors'),
  ('Sports & Recreation', 'sports-and-recreation'),
  ('Tech & Electronics', 'tech-and-electronics'),
  ('Tools & Home Improvement', 'tools-and-home-improvement'),
  ('Toys & Games', 'toys-and-games'),
  ('Travel & Hospitality', 'travel-and-hospitality'),
  ('Travel & Luggage', 'travel-and-luggage'),
  ('Video Games', 'video-games')
ON CONFLICT DO NOTHING;

WITH legacy AS (
  SELECT DISTINCT trim(category) AS name
  FROM public.listings
  WHERE category IS NOT NULL AND trim(category) <> ''
), normalized AS (
  SELECT
    name,
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(name), '&', 'and', 'g'),
        '[^a-z0-9]+', '-', 'g'
      ),
      '(^-+)|(-+$)',
      '',
      'g'
    ) AS base_slug
  FROM legacy
), deduped AS (
  SELECT
    name,
    CASE
      WHEN base_slug = '' THEN 'category-' || substring(md5(name), 1, 6)
      WHEN EXISTS (
        SELECT 1 FROM public.business_categories bc WHERE bc.slug = base_slug
      ) THEN base_slug || '-' || substring(md5(name), 1, 6)
      ELSE base_slug
    END AS slug
  FROM normalized
)
INSERT INTO public.business_categories (name, slug)
SELECT name, slug
FROM deduped
WHERE NOT EXISTS (
  SELECT 1 FROM public.business_categories bc WHERE bc.name = deduped.name
)
ON CONFLICT DO NOTHING;

UPDATE public.listings l
SET category_id = c.id
FROM public.business_categories c
WHERE l.category_id IS NULL
  AND l.category IS NOT NULL
  AND l.category = c.name;

CREATE OR REPLACE FUNCTION public.sync_listing_category_fields()
RETURNS trigger AS $$
DECLARE
  resolved_name text;
  resolved_id uuid;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT name INTO resolved_name
    FROM public.business_categories
    WHERE id = NEW.category_id;
    IF resolved_name IS NOT NULL
      AND (NEW.category IS NULL OR NEW.category = '' OR NEW.category <> resolved_name)
    THEN
      NEW.category = resolved_name;
    END IF;
  ELSIF NEW.category IS NOT NULL AND NEW.category <> '' THEN
    SELECT id INTO resolved_id
    FROM public.business_categories
    WHERE name = NEW.category;
    IF resolved_id IS NOT NULL THEN
      NEW.category_id = resolved_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS listings_sync_category_fields ON public.listings;
CREATE TRIGGER listings_sync_category_fields
BEFORE INSERT OR UPDATE OF category_id, category ON public.listings
FOR EACH ROW EXECUTE FUNCTION public.sync_listing_category_fields();
