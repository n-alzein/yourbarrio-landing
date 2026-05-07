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

DO $do$
BEGIN
  IF to_regprocedure('public.set_row_updated_at()') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.set_row_updated_at()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $set_row_updated_at$
      BEGIN
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $set_row_updated_at$;
    $sql$;
  END IF;
END
$do$;

CREATE TABLE IF NOT EXISTS public.platform_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  message text NOT NULL,
  cta_label text,
  cta_href text,
  audience text NOT NULL,
  variant text NOT NULL DEFAULT 'info',
  priority integer NOT NULL DEFAULT 50,
  starts_at timestamptz,
  ends_at timestamptz,
  dismissible boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_announcements_audience_valid CHECK (audience IN ('all', 'guests', 'customers', 'businesses')),
  CONSTRAINT platform_announcements_variant_valid CHECK (variant IN ('info', 'warning', 'critical')),
  CONSTRAINT platform_announcements_status_valid CHECK (status IN ('draft', 'active', 'archived')),
  CONSTRAINT platform_announcements_message_present CHECK (length(btrim(message)) > 0),
  CONSTRAINT platform_announcements_title_length CHECK (title IS NULL OR length(title) <= 120),
  CONSTRAINT platform_announcements_message_length CHECK (length(message) <= 240),
  CONSTRAINT platform_announcements_cta_label_requires_href CHECK (cta_label IS NULL OR cta_href IS NOT NULL),
  CONSTRAINT platform_announcements_time_window_valid CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS idx_platform_announcements_status_window
  ON public.platform_announcements(status, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_audience_status
  ON public.platform_announcements(audience, status);
CREATE INDEX IF NOT EXISTS idx_platform_announcements_priority_desc
  ON public.platform_announcements(priority DESC);

DROP TRIGGER IF EXISTS platform_announcements_set_updated_at ON public.platform_announcements;
CREATE TRIGGER platform_announcements_set_updated_at
BEFORE UPDATE ON public.platform_announcements
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_announcements'
      AND policyname = 'Support ops super can view announcements'
  ) THEN
    CREATE POLICY "Support ops super can view announcements"
      ON public.platform_announcements
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_support','admin_ops','admin_super']::text[])
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_announcements'
      AND policyname = 'Ops super can insert announcements'
  ) THEN
    CREATE POLICY "Ops super can insert announcements"
      ON public.platform_announcements
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_ops','admin_super']::text[])
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_announcements'
      AND policyname = 'Ops super can update announcements'
  ) THEN
    CREATE POLICY "Ops super can update announcements"
      ON public.platform_announcements
      FOR UPDATE
      TO authenticated
      USING (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_ops','admin_super']::text[])
      )
      WITH CHECK (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_ops','admin_super']::text[])
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'platform_announcements'
      AND policyname = 'Super can delete announcements'
  ) THEN
    CREATE POLICY "Super can delete announcements"
      ON public.platform_announcements
      FOR DELETE
      TO authenticated
      USING (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_super']::text[])
      );
  END IF;
END $$;
