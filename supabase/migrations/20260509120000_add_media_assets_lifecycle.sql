CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_id uuid NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  listing_id uuid NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'temporary',
  bucket text NOT NULL,
  original_path text NULL,
  source_path text NULL,
  thumb_path text NULL,
  card_path text NULL,
  detail_path text NULL,
  cover_mobile_path text NULL,
  cover_desktop_path text NULL,
  avatar_128_path text NULL,
  avatar_256_path text NULL,
  public_url text NULL,
  width integer NULL,
  height integer NULL,
  size_bytes bigint NULL,
  mime_type text NULL,
  alt_text text NULL,
  sort_order integer NULL,
  upload_session_id text NULL,
  expires_at timestamptz NULL,
  committed_at timestamptz NULL,
  replaced_at timestamptz NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_status_check'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_status_check
      CHECK (status IN ('temporary', 'active', 'replaced', 'deleted', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_purpose_check'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_purpose_check
      CHECK (purpose IN (
        'listing_image',
        'listing_cover',
        'business_cover',
        'business_avatar',
        'business_gallery',
        'user_avatar',
        'temp_upload'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'media_assets_lifecycle_dates_check'
  ) THEN
    ALTER TABLE public.media_assets
      ADD CONSTRAINT media_assets_lifecycle_dates_check
      CHECK (
        (status <> 'temporary' OR expires_at IS NOT NULL)
        AND (status <> 'active' OR committed_at IS NOT NULL)
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS media_assets_owner_user_id_idx
  ON public.media_assets (owner_user_id);

CREATE INDEX IF NOT EXISTS media_assets_business_id_idx
  ON public.media_assets (business_id);

CREATE INDEX IF NOT EXISTS media_assets_listing_id_idx
  ON public.media_assets (listing_id);

CREATE INDEX IF NOT EXISTS media_assets_status_idx
  ON public.media_assets (status);

CREATE INDEX IF NOT EXISTS media_assets_purpose_idx
  ON public.media_assets (purpose);

CREATE INDEX IF NOT EXISTS media_assets_expires_at_idx
  ON public.media_assets (expires_at)
  WHERE status = 'temporary';

CREATE INDEX IF NOT EXISTS media_assets_upload_session_id_idx
  ON public.media_assets (upload_session_id);

CREATE OR REPLACE FUNCTION public.set_media_assets_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS media_assets_set_updated_at ON public.media_assets;
CREATE TRIGGER media_assets_set_updated_at
  BEFORE UPDATE ON public.media_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_media_assets_updated_at();

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_assets_owner_select'
  ) THEN
    CREATE POLICY media_assets_owner_select
      ON public.media_assets FOR SELECT
      USING (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_assets_business_owner_select'
  ) THEN
    CREATE POLICY media_assets_business_owner_select
      ON public.media_assets FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.businesses b
          WHERE b.id = media_assets.business_id
            AND b.owner_user_id = auth.uid()
        )
      );
  END IF;

  DROP POLICY IF EXISTS media_assets_public_active_select ON public.media_assets;

  CREATE POLICY media_assets_public_active_select
    ON public.media_assets FOR SELECT
    USING (
      status = 'active'
      AND (
        EXISTS (
          SELECT 1
          FROM public.listings l
          JOIN public.businesses b ON b.owner_user_id = l.business_id
          WHERE l.id = media_assets.listing_id
            AND COALESCE(l.admin_hidden, false) = false
            AND l.deleted_at IS NULL
            AND l.status = 'published'
            AND (
              COALESCE(b.verification_status, '') IN ('verified', 'approved')
              OR COALESCE(b.is_internal, false) = true
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.businesses b
          WHERE b.id = media_assets.business_id
            AND (
              COALESCE(b.verification_status, '') IN ('verified', 'approved')
              OR COALESCE(b.is_internal, false) = true
            )
        )
      )
    );

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_assets_owner_insert'
  ) THEN
    CREATE POLICY media_assets_owner_insert
      ON public.media_assets FOR INSERT
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'media_assets_owner_update'
  ) THEN
    CREATE POLICY media_assets_owner_update
      ON public.media_assets FOR UPDATE
      USING (auth.uid() = owner_user_id)
      WITH CHECK (auth.uid() = owner_user_id);
  END IF;
END $$;
