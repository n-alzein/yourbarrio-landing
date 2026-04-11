SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE OR REPLACE VIEW public.user_public_profiles AS
SELECT
  u.id AS user_id,
  COALESCE(
    NULLIF(btrim(u.full_name), ''),
    NULLIF(btrim(u.business_name), '')
  ) AS display_name,
  NULLIF(btrim(u.profile_photo_url), '') AS avatar_url
FROM public.users u;

ALTER VIEW public.user_public_profiles SET (security_invoker = false);

GRANT SELECT ON TABLE public.user_public_profiles TO anon;
GRANT SELECT ON TABLE public.user_public_profiles TO authenticated;
GRANT SELECT ON TABLE public.user_public_profiles TO service_role;

COMMENT ON VIEW public.user_public_profiles IS
  'Public-safe reviewer/business profile surface. Exposes only user_id, display_name, and avatar_url.';

NOTIFY pgrst, 'reload schema';
