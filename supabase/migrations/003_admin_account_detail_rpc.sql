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

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_role_members arm
    WHERE arm.user_id = auth.uid()
      AND arm.role_key IN ('admin_readonly', 'admin_support', 'admin_ops', 'admin_super')
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_account(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  public_id text,
  email text,
  full_name text,
  phone text,
  business_name text,
  role text,
  is_internal boolean,
  city text,
  created_at timestamptz,
  admin_role_keys text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_user_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH role_members AS (
    SELECT
      arm.user_id,
      array_agg(DISTINCT arm.role_key ORDER BY arm.role_key)::text[] AS role_keys
    FROM public.admin_role_members arm
    GROUP BY arm.user_id
  )
  SELECT
    u.id::uuid,
    u.public_id::text,
    u.email::text,
    u.full_name::text,
    u.phone::text,
    u.business_name::text,
    COALESCE(NULLIF(lower(u.role), ''), 'customer')::text AS role,
    COALESCE(u.is_internal, false) AS is_internal,
    u.city::text,
    u.created_at::timestamptz,
    COALESCE(rm.role_keys, ARRAY[]::text[]) AS admin_role_keys
  FROM public.users u
  LEFT JOIN role_members rm
    ON rm.user_id = u.id
  WHERE u.id = p_user_id
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_account(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_account(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_account_by_public_id(p_public_id text)
RETURNS TABLE (
  id uuid,
  public_id text,
  email text,
  full_name text,
  phone text,
  business_name text,
  role text,
  is_internal boolean,
  city text,
  created_at timestamptz,
  admin_role_keys text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND public.is_admin())
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_public_id IS NULL OR btrim(p_public_id) = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH role_members AS (
    SELECT
      arm.user_id,
      array_agg(DISTINCT arm.role_key ORDER BY arm.role_key)::text[] AS role_keys
    FROM public.admin_role_members arm
    GROUP BY arm.user_id
  )
  SELECT
    u.id::uuid,
    u.public_id::text,
    u.email::text,
    u.full_name::text,
    u.phone::text,
    u.business_name::text,
    COALESCE(NULLIF(lower(u.role), ''), 'customer')::text AS role,
    COALESCE(u.is_internal, false) AS is_internal,
    u.city::text,
    u.created_at::timestamptz,
    COALESCE(rm.role_keys, ARRAY[]::text[]) AS admin_role_keys
  FROM public.users u
  LEFT JOIN role_members rm
    ON rm.user_id = u.id
  WHERE lower(COALESCE(u.public_id, '')) = lower(btrim(p_public_id))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_account_by_public_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_account_by_public_id(text) TO authenticated;
