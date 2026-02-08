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

CREATE OR REPLACE FUNCTION public.create_impersonation_session(
  target_user_id uuid,
  minutes integer DEFAULT 30,
  reason text DEFAULT NULL,
  meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_id uuid;
  inserted_id uuid;
  ttl_minutes integer;
  resolved_target_role text;
BEGIN
  actor_id := auth.uid();
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_support') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id is required';
  END IF;

  IF actor_id = target_user_id THEN
    RAISE EXCEPTION 'Cannot impersonate self';
  END IF;

  SELECT CASE WHEN u.role = 'business' THEN 'business' ELSE 'customer' END
  INTO resolved_target_role
  FROM public.users u
  WHERE u.id = target_user_id;

  IF resolved_target_role IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  ttl_minutes := GREATEST(COALESCE(minutes, 30), 1);

  INSERT INTO public.admin_impersonation_sessions (
    actor_user_id,
    target_user_id,
    target_role,
    reason,
    meta,
    expires_at,
    active
  ) VALUES (
    actor_id,
    target_user_id,
    resolved_target_role,
    reason,
    COALESCE(meta, '{}'::jsonb) || jsonb_build_object('target_role', resolved_target_role),
    now() + make_interval(mins => ttl_minutes),
    true
  )
  RETURNING id INTO inserted_id;

  PERFORM public.log_admin_action(
    'impersonation_start',
    'user',
    target_user_id::text,
    jsonb_build_object(
      'session_id', inserted_id,
      'minutes', ttl_minutes,
      'reason', reason,
      'target_role', resolved_target_role,
      'meta', COALESCE(meta, '{}'::jsonb)
    ),
    actor_id
  );

  RETURN inserted_id;
END;
$$;

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

  IF NOT public.is_admin() THEN
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
