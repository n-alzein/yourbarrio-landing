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

ALTER TABLE IF EXISTS public.admin_impersonation_sessions
  ADD COLUMN IF NOT EXISTS target_role text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_impersonation_sessions_target_role_valid'
      AND conrelid = 'public.admin_impersonation_sessions'::regclass
  ) THEN
    ALTER TABLE public.admin_impersonation_sessions
      ADD CONSTRAINT admin_impersonation_sessions_target_role_valid
      CHECK (target_role IS NULL OR target_role IN ('customer', 'business'));
  END IF;
END $$;

UPDATE public.admin_impersonation_sessions s
SET target_role = CASE
  WHEN u.role = 'business' THEN 'business'
  ELSE 'customer'
END
FROM public.users u
WHERE s.target_user_id = u.id
  AND s.target_role IS NULL;

CREATE OR REPLACE FUNCTION public.get_impersonation_session(p_session_id uuid)
RETURNS TABLE (
  session_id uuid,
  actor_user_id uuid,
  target_user_id uuid,
  target_role text,
  expires_at timestamptz,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.has_admin_role('admin_support') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.actor_user_id,
    s.target_user_id,
    COALESCE(s.target_role, CASE WHEN u.role = 'business' THEN 'business' ELSE 'customer' END) AS target_role,
    s.expires_at,
    (s.active = true AND s.ended_at IS NULL AND s.expires_at > now()) AS is_active
  FROM public.admin_impersonation_sessions s
  LEFT JOIN public.users u ON u.id = s.target_user_id
  WHERE s.id = p_session_id
    AND s.actor_user_id = current_user_id
    AND s.active = true
    AND s.ended_at IS NULL
    AND s.expires_at > now()
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_impersonation_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_impersonation_session(uuid) TO authenticated;

-- Verification snippet (admin-only, run after deploy):
-- SELECT column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'admin_impersonation_sessions'
--   AND column_name = 'target_role';
