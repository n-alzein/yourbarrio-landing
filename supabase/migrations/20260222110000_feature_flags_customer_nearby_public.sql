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

CREATE TABLE IF NOT EXISTS public.feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL REFERENCES public.users(id) ON DELETE SET NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_row_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    CREATE FUNCTION public.set_row_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

DROP TRIGGER IF EXISTS feature_flags_set_updated_at ON public.feature_flags;
CREATE TRIGGER feature_flags_set_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

INSERT INTO public.feature_flags (key, enabled)
VALUES ('customer_nearby_public', false)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE IF EXISTS public.feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read allowlisted feature flags" ON public.feature_flags;
CREATE POLICY "Public can read allowlisted feature flags"
  ON public.feature_flags
  FOR SELECT
  TO anon, authenticated
  USING (
    key = 'customer_nearby_public'
  );

DROP POLICY IF EXISTS "Super admins can update allowlisted feature flags" ON public.feature_flags;
CREATE POLICY "Super admins can update allowlisted feature flags"
  ON public.feature_flags
  FOR UPDATE
  TO authenticated
  USING (
    key = 'customer_nearby_public'
    AND public.has_admin_role('admin_super')
  )
  WITH CHECK (
    key = 'customer_nearby_public'
    AND public.has_admin_role('admin_super')
  );

REVOKE ALL ON TABLE public.feature_flags FROM anon, authenticated;
GRANT SELECT ON TABLE public.feature_flags TO anon, authenticated;
GRANT UPDATE (enabled, updated_by) ON TABLE public.feature_flags TO authenticated;
