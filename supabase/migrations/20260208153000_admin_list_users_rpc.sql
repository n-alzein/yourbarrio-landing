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

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_role text DEFAULT 'all',
  p_q text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_from integer DEFAULT 0,
  p_to integer DEFAULT 19
)
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  phone text,
  business_name text,
  role text,
  city text,
  created_at timestamptz,
  is_internal boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(NULLIF(lower(trim(p_role)), ''), 'all');
  v_from integer := GREATEST(COALESCE(p_from, 0), 0);
  v_to integer := GREATEST(COALESCE(p_to, 19), 0);
  v_limit integer := GREATEST(v_to - v_from + 1, 0);
  v_has_profiles boolean := to_regclass('public.profiles') IS NOT NULL;
  v_profiles_sql text;
  v_sql text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF v_has_profiles THEN
    v_profiles_sql := $profiles$
      SELECT
        CASE
          WHEN COALESCE(NULLIF(to_jsonb(p) ->> 'user_id', ''), NULLIF(to_jsonb(p) ->> 'id', '')) ~* '^[0-9a-fA-F-]{36}$'
            THEN COALESCE(NULLIF(to_jsonb(p) ->> 'user_id', ''), NULLIF(to_jsonb(p) ->> 'id', ''))::uuid
          ELSE NULL
        END AS id,
        COALESCE(NULLIF(to_jsonb(p) ->> 'email', ''), u.email)::text AS email,
        NULLIF(to_jsonb(p) ->> 'full_name', '')::text AS full_name,
        NULLIF(to_jsonb(p) ->> 'phone', '')::text AS phone,
        NULL::text AS business_name,
        'customer'::text AS role,
        NULLIF(to_jsonb(p) ->> 'city', '')::text AS city,
        COALESCE(
          NULLIF(to_jsonb(p) ->> 'created_at', '')::timestamptz,
          NULLIF(to_jsonb(p) ->> 'updated_at', '')::timestamptz,
          u.created_at
        )::timestamptz AS created_at,
        false::boolean AS is_internal,
        2::integer AS src_priority
      FROM public.profiles p
      LEFT JOIN public.users u
        ON u.id = CASE
          WHEN COALESCE(NULLIF(to_jsonb(p) ->> 'user_id', ''), NULLIF(to_jsonb(p) ->> 'id', '')) ~* '^[0-9a-fA-F-]{36}$'
            THEN COALESCE(NULLIF(to_jsonb(p) ->> 'user_id', ''), NULLIF(to_jsonb(p) ->> 'id', ''))::uuid
          ELSE NULL
        END
      WHERE
        ($1 IN ('all', 'customer'))
        AND COALESCE(NULLIF(lower(NULLIF(to_jsonb(p) ->> 'role', '')), ''), 'customer') <> 'business'
        AND (
          $2 IS NULL OR btrim($2) = '' OR (
            COALESCE(NULLIF(to_jsonb(p) ->> 'full_name', ''), '') ILIKE '%' || $2 || '%'
            OR COALESCE(NULLIF(to_jsonb(p) ->> 'email', ''), u.email, '') ILIKE '%' || $2 || '%'
            OR COALESCE(NULLIF(to_jsonb(p) ->> 'phone', ''), '') ILIKE '%' || $2 || '%'
          )
        )
        AND (
          $3 IS NULL OR btrim($3) = '' OR COALESCE(NULLIF(to_jsonb(p) ->> 'city', ''), '') ILIKE '%' || $3 || '%'
        )
    $profiles$;
  ELSE
    v_profiles_sql := $empty$
      SELECT
        NULL::uuid AS id,
        NULL::text AS email,
        NULL::text AS full_name,
        NULL::text AS phone,
        NULL::text AS business_name,
        NULL::text AS role,
        NULL::text AS city,
        NULL::timestamptz AS created_at,
        NULL::boolean AS is_internal,
        2::integer AS src_priority
      WHERE FALSE
    $empty$;
  END IF;

  v_sql := format($fmt$
    WITH users_src AS (
      SELECT
        u.id::uuid AS id,
        u.email::text AS email,
        u.full_name::text AS full_name,
        u.phone::text AS phone,
        u.business_name::text AS business_name,
        COALESCE(NULLIF(u.role, ''), 'customer')::text AS role,
        u.city::text AS city,
        u.created_at::timestamptz AS created_at,
        COALESCE((to_jsonb(u) ->> 'is_internal')::boolean, false) AS is_internal,
        1::integer AS src_priority
      FROM public.users u
      WHERE
        CASE
          WHEN $1 = 'business' THEN u.role = 'business'
          WHEN $1 = 'customer' THEN (u.role IS NULL OR u.role <> 'business')
          ELSE true
        END
        AND (
          $2 IS NULL OR btrim($2) = '' OR (
            COALESCE(u.full_name, '') ILIKE '%%' || $2 || '%%'
            OR COALESCE(u.email, '') ILIKE '%%' || $2 || '%%'
            OR COALESCE(u.phone, '') ILIKE '%%' || $2 || '%%'
            OR COALESCE(u.business_name, '') ILIKE '%%' || $2 || '%%'
          )
        )
        AND (
          $3 IS NULL OR btrim($3) = '' OR COALESCE(u.city, '') ILIKE '%%' || $3 || '%%'
        )
    ),
    profiles_src AS (
      %s
    ),
    merged AS (
      SELECT * FROM users_src
      UNION ALL
      SELECT * FROM profiles_src WHERE id IS NOT NULL
    ),
    deduped AS (
      SELECT id, email, full_name, phone, business_name, role, city, created_at, is_internal
      FROM (
        SELECT
          m.*,
          row_number() OVER (PARTITION BY m.id ORDER BY m.src_priority ASC, m.created_at DESC NULLS LAST) AS rn
        FROM merged m
      ) ranked
      WHERE rn = 1
    )
    SELECT
      d.id,
      d.email,
      d.full_name,
      d.phone,
      d.business_name,
      d.role,
      d.city,
      d.created_at,
      d.is_internal
    FROM deduped d
    ORDER BY d.created_at DESC NULLS LAST
    OFFSET $4
    LIMIT $5
  $fmt$, v_profiles_sql);

  RETURN QUERY EXECUTE v_sql USING v_role, p_q, p_city, v_from, v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO authenticated;
