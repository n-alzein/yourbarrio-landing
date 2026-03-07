-- 0) Optional safety: ensure updated_at exists; if not, remove updated_at usage below.

-- 1) Backfill existing businesses (safe, no overwrite with NULL)
UPDATE public.businesses b
SET
  profile_photo_url = COALESCE(b.profile_photo_url, u.profile_photo_url),
  cover_photo_url   = COALESCE(b.cover_photo_url,   u.cover_photo_url),
  updated_at        = COALESCE(b.updated_at, now())
FROM public.users u
WHERE b.owner_user_id = u.id
  AND (b.profile_photo_url IS NULL OR b.cover_photo_url IS NULL);

-- 2) Sync function: when user photos change, update the owning business (do not overwrite with NULL)
CREATE OR REPLACE FUNCTION public.sync_business_photos_from_user()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only act when something actually changed
  IF (NEW.profile_photo_url IS NOT DISTINCT FROM OLD.profile_photo_url)
     AND (NEW.cover_photo_url   IS NOT DISTINCT FROM OLD.cover_photo_url)
  THEN
    RETURN NEW;
  END IF;

  -- Mirror into businesses for the owner (if they have a business row)
  UPDATE public.businesses
  SET
    profile_photo_url = COALESCE(NEW.profile_photo_url, profile_photo_url),
    cover_photo_url   = COALESCE(NEW.cover_photo_url,   cover_photo_url),
    updated_at        = now()
  WHERE owner_user_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_business_photos_from_user ON public.users;

CREATE TRIGGER trg_sync_business_photos_from_user
AFTER UPDATE OF profile_photo_url, cover_photo_url ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_business_photos_from_user();

-- 3) Init function: on business insert, if business photo fields are NULL, copy from users at creation time
CREATE OR REPLACE FUNCTION public.init_business_photos_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  u_profile text;
  u_cover   text;
BEGIN
  -- Only fill missing values
  IF NEW.profile_photo_url IS NOT NULL AND NEW.cover_photo_url IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT profile_photo_url, cover_photo_url
  INTO u_profile, u_cover
  FROM public.users
  WHERE id = NEW.owner_user_id;

  IF NEW.profile_photo_url IS NULL THEN
    NEW.profile_photo_url := u_profile;
  END IF;

  IF NEW.cover_photo_url IS NULL THEN
    NEW.cover_photo_url := u_cover;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_business_photos_on_insert ON public.businesses;

CREATE TRIGGER trg_init_business_photos_on_insert
BEFORE INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.init_business_photos_on_insert();

-- 4) Lock down function execution (defense-in-depth)
REVOKE ALL ON FUNCTION public.sync_business_photos_from_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.init_business_photos_on_insert() FROM PUBLIC;
