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

CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
  p_q text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  action text,
  target_type text,
  target_id text,
  target_name text,
  target_email text,
  target_label text,
  meta jsonb,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(trim(COALESCE(p_q, '')), '');
  v_action text := NULLIF(trim(COALESCE(p_action, '')), '');
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_readonly') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      l.*,
      CASE
        WHEN COALESCE(l.target_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN l.target_id::uuid
        ELSE NULL::uuid
      END AS target_uuid
    FROM public.admin_audit_log l
    WHERE
      (v_action IS NULL OR l.action ILIKE '%' || v_action || '%')
      AND (p_from IS NULL OR l.created_at >= p_from)
      AND (p_to IS NULL OR l.created_at <= p_to)
  ),
  enriched AS (
    SELECT
      b.id,
      b.created_at,
      b.actor_user_id,
      NULLIF(trim(u_actor.full_name), '')::text AS actor_name,
      NULLIF(trim(u_actor.email), '')::text AS actor_email,
      b.action,
      b.target_type,
      b.target_id,
      CASE
        WHEN b.target_type = 'user' THEN NULLIF(trim(u_target.full_name), '')
        WHEN b.target_type = 'business' THEN NULLIF(trim(COALESCE(biz.business_name, biz.name)), '')
        WHEN b.target_type = 'listing' THEN NULLIF(trim(li.title), '')
        ELSE NULL
      END::text AS target_name,
      CASE
        WHEN b.target_type = 'user' THEN NULLIF(trim(u_target.email), '')
        ELSE NULL
      END::text AS target_email,
      CASE
        WHEN b.target_type = 'user' THEN COALESCE(
          CASE
            WHEN NULLIF(trim(u_target.full_name), '') IS NOT NULL AND NULLIF(trim(u_target.email), '') IS NOT NULL
              THEN trim(u_target.full_name) || ' <' || trim(u_target.email) || '>'
            WHEN NULLIF(trim(u_target.email), '') IS NOT NULL
              THEN trim(u_target.email)
            WHEN NULLIF(trim(u_target.full_name), '') IS NOT NULL
              THEN trim(u_target.full_name)
            ELSE NULL
          END,
          COALESCE(NULLIF(trim(b.target_id), ''), 'user:unknown')
        )
        WHEN b.target_type = 'business' THEN COALESCE(
          NULLIF(trim(COALESCE(biz.business_name, biz.name)), ''),
          CASE
            WHEN NULLIF(trim(COALESCE(biz.public_id, b.target_id)), '') IS NOT NULL
              THEN 'business: ' || trim(COALESCE(biz.public_id, b.target_id))
            ELSE 'business:unknown'
          END
        )
        WHEN b.target_type = 'listing' THEN COALESCE(
          NULLIF(trim(li.title), ''),
          CASE
            WHEN NULLIF(trim(COALESCE(li.public_id, b.target_id)), '') IS NOT NULL
              THEN 'listing: ' || trim(COALESCE(li.public_id, b.target_id))
            ELSE 'listing:unknown'
          END
        )
        ELSE COALESCE(
          NULLIF(trim(COALESCE(b.target_type, '')), '') || ':' || COALESCE(NULLIF(trim(b.target_id), ''), '-'),
          COALESCE(NULLIF(trim(b.target_id), ''), '-')
        )
      END::text AS target_label,
      b.meta
    FROM base b
    LEFT JOIN public.users u_actor
      ON u_actor.id = b.actor_user_id
    LEFT JOIN public.users u_target
      ON b.target_type = 'user'
      AND u_target.id = b.target_uuid
    LEFT JOIN public.businesses biz
      ON b.target_type = 'business'
      AND (
        biz.id = b.target_uuid
        OR lower(COALESCE(biz.public_id, '')) = lower(COALESCE(b.target_id, ''))
      )
    LEFT JOIN public.listings li
      ON b.target_type = 'listing'
      AND (
        li.id = b.target_uuid
        OR lower(COALESCE(li.public_id, '')) = lower(COALESCE(b.target_id, ''))
      )
  )
  SELECT
    e.id,
    e.created_at,
    e.actor_user_id,
    e.actor_name,
    e.actor_email,
    e.action,
    e.target_type,
    e.target_id,
    e.target_name,
    e.target_email,
    e.target_label,
    e.meta,
    COUNT(*) OVER()::bigint AS total_count
  FROM enriched e
  WHERE
    v_q IS NULL
    OR COALESCE(e.action, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.actor_name, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.actor_email, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_name, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_email, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_label, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_id, '') ILIKE '%' || v_q || '%'
  ORDER BY e.created_at DESC, e.id DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_audit_logs(text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(text, text, timestamptz, timestamptz, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_user_audit_activity(
  p_user_id uuid,
  p_include_actor boolean DEFAULT true,
  p_include_target boolean DEFAULT true,
  p_q text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  actor_user_id uuid,
  actor_name text,
  actor_email text,
  action text,
  target_type text,
  target_id text,
  target_name text,
  target_email text,
  target_label text,
  meta jsonb,
  relation text,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := NULLIF(trim(COALESCE(p_q, '')), '');
  v_action text := NULLIF(trim(COALESCE(p_action, '')), '');
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_include_actor boolean := COALESCE(p_include_actor, true);
  v_include_target boolean := COALESCE(p_include_target, true);
  v_user_public_id text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_readonly') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  SELECT NULLIF(trim(u.public_id), '')
  INTO v_user_public_id
  FROM public.users u
  WHERE u.id = p_user_id
  LIMIT 1;

  IF (NOT v_include_actor) AND (NOT v_include_target) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      l.*,
      CASE
        WHEN COALESCE(l.target_id, '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          THEN l.target_id::uuid
        ELSE NULL::uuid
      END AS target_uuid
    FROM public.admin_audit_log l
    WHERE (v_action IS NULL OR l.action ILIKE '%' || v_action || '%')
  ),
  matched AS (
    SELECT
      b.*,
      (b.actor_user_id = p_user_id) AS is_actor_match,
      (
        b.target_type = 'user'
        AND (
          b.target_uuid = p_user_id
          OR (
            v_user_public_id IS NOT NULL
            AND lower(COALESCE(b.target_id, '')) = lower(v_user_public_id)
          )
        )
      ) AS is_target_match
    FROM base b
    WHERE
      (v_include_actor AND b.actor_user_id = p_user_id)
      OR (
        v_include_target
        AND b.target_type = 'user'
        AND (
          b.target_uuid = p_user_id
          OR (
            v_user_public_id IS NOT NULL
            AND lower(COALESCE(b.target_id, '')) = lower(v_user_public_id)
          )
        )
      )
  ),
  enriched AS (
    SELECT
      m.id,
      m.created_at,
      m.actor_user_id,
      NULLIF(trim(u_actor.full_name), '')::text AS actor_name,
      NULLIF(trim(u_actor.email), '')::text AS actor_email,
      m.action,
      m.target_type,
      m.target_id,
      CASE
        WHEN m.target_type = 'user' THEN NULLIF(trim(u_target.full_name), '')
        WHEN m.target_type = 'business' THEN NULLIF(trim(COALESCE(biz.business_name, biz.name)), '')
        WHEN m.target_type = 'listing' THEN NULLIF(trim(li.title), '')
        ELSE NULL
      END::text AS target_name,
      CASE
        WHEN m.target_type = 'user' THEN NULLIF(trim(u_target.email), '')
        ELSE NULL
      END::text AS target_email,
      CASE
        WHEN m.target_type = 'user' THEN COALESCE(
          CASE
            WHEN NULLIF(trim(u_target.full_name), '') IS NOT NULL AND NULLIF(trim(u_target.email), '') IS NOT NULL
              THEN trim(u_target.full_name) || ' <' || trim(u_target.email) || '>'
            WHEN NULLIF(trim(u_target.email), '') IS NOT NULL
              THEN trim(u_target.email)
            WHEN NULLIF(trim(u_target.full_name), '') IS NOT NULL
              THEN trim(u_target.full_name)
            ELSE NULL
          END,
          COALESCE(NULLIF(trim(m.target_id), ''), 'user:unknown')
        )
        WHEN m.target_type = 'business' THEN COALESCE(
          NULLIF(trim(COALESCE(biz.business_name, biz.name)), ''),
          CASE
            WHEN NULLIF(trim(COALESCE(biz.public_id, m.target_id)), '') IS NOT NULL
              THEN 'business: ' || trim(COALESCE(biz.public_id, m.target_id))
            ELSE 'business:unknown'
          END
        )
        WHEN m.target_type = 'listing' THEN COALESCE(
          NULLIF(trim(li.title), ''),
          CASE
            WHEN NULLIF(trim(COALESCE(li.public_id, m.target_id)), '') IS NOT NULL
              THEN 'listing: ' || trim(COALESCE(li.public_id, m.target_id))
            ELSE 'listing:unknown'
          END
        )
        ELSE COALESCE(
          NULLIF(trim(COALESCE(m.target_type, '')), '') || ':' || COALESCE(NULLIF(trim(m.target_id), ''), '-'),
          COALESCE(NULLIF(trim(m.target_id), ''), '-')
        )
      END::text AS target_label,
      m.meta,
      CASE
        WHEN m.is_actor_match AND m.is_target_match THEN 'both'
        WHEN m.is_actor_match THEN 'actor'
        WHEN m.is_target_match THEN 'target'
        ELSE NULL
      END::text AS relation
    FROM matched m
    LEFT JOIN public.users u_actor
      ON u_actor.id = m.actor_user_id
    LEFT JOIN public.users u_target
      ON m.target_type = 'user'
      AND u_target.id = m.target_uuid
    LEFT JOIN public.businesses biz
      ON m.target_type = 'business'
      AND (
        biz.id = m.target_uuid
        OR lower(COALESCE(biz.public_id, '')) = lower(COALESCE(m.target_id, ''))
      )
    LEFT JOIN public.listings li
      ON m.target_type = 'listing'
      AND (
        li.id = m.target_uuid
        OR lower(COALESCE(li.public_id, '')) = lower(COALESCE(m.target_id, ''))
      )
  )
  SELECT
    e.id,
    e.created_at,
    e.actor_user_id,
    e.actor_name,
    e.actor_email,
    e.action,
    e.target_type,
    e.target_id,
    e.target_name,
    e.target_email,
    e.target_label,
    e.meta,
    e.relation,
    COUNT(*) OVER()::bigint AS total_count
  FROM enriched e
  WHERE
    v_q IS NULL
    OR COALESCE(e.action, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.actor_name, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.actor_email, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_name, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_email, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_label, '') ILIKE '%' || v_q || '%'
    OR COALESCE(e.target_id, '') ILIKE '%' || v_q || '%'
  ORDER BY e.created_at DESC, e.id DESC
  OFFSET v_offset
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_user_audit_activity(uuid, boolean, boolean, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_user_audit_activity(uuid, boolean, boolean, text, text, integer, integer) TO authenticated;
