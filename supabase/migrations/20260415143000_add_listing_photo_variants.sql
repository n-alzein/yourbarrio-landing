BEGIN;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS photo_variants jsonb;

COMMIT;
