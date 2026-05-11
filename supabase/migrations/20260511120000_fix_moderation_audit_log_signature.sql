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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'log_admin_action'
      AND pg_catalog.oidvectortypes(p.proargtypes) = 'text, uuid, text, text, jsonb'
  ) THEN
    EXECUTE $create$
    CREATE FUNCTION public.log_admin_action(
      action text,
      actor_user_id uuid,
      target_type text,
      target_id text,
      meta jsonb
    )
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $fn$
    DECLARE
      inserted_id uuid;
    BEGIN
      IF action IS NULL OR length(trim(action)) = 0 THEN
        RAISE EXCEPTION 'action is required';
      END IF;

      INSERT INTO public.admin_audit_log (
        action,
        actor_user_id,
        target_type,
        target_id,
        meta
      ) VALUES (
        action,
        actor_user_id,
        target_type,
        target_id,
        COALESCE(meta, '{}'::jsonb)
      )
      RETURNING id INTO inserted_id;

      RETURN inserted_id;
    END;
    $fn$;
    $create$;

    REVOKE ALL ON FUNCTION public.log_admin_action(text, uuid, text, text, jsonb) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.log_admin_action(text, uuid, text, text, jsonb) TO authenticated;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_moderation_flag(
  p_flag_id uuid,
  p_status text,
  p_admin_notes text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_status text;
  v_prev_status text;
  v_target_type text;
  v_target_id uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_ops') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  v_status := lower(trim(COALESCE(p_status, '')));
  IF v_status NOT IN ('open', 'in_review', 'resolved', 'dismissed') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT
    mf.status,
    CASE
      WHEN mf.target_listing_id IS NOT NULL THEN 'listing'
      WHEN mf.target_review_id IS NOT NULL THEN 'review'
      WHEN mf.target_business_id IS NOT NULL THEN 'business'
      ELSE 'user'
    END,
    COALESCE(mf.target_listing_id, mf.target_review_id, mf.target_business_id, mf.target_user_id)
  INTO v_prev_status, v_target_type, v_target_id
  FROM public.moderation_flags mf
  WHERE mf.id = p_flag_id;

  IF v_prev_status IS NULL THEN
    RAISE EXCEPTION 'Moderation flag not found';
  END IF;

  UPDATE public.moderation_flags
  SET
    status = v_status,
    admin_notes = CASE
      WHEN p_admin_notes IS NULL THEN admin_notes
      ELSE NULLIF(trim(p_admin_notes), '')
    END,
    reviewed_by_user_id = v_actor_id,
    reviewed_at = now()
  WHERE id = p_flag_id;

  PERFORM public.log_admin_action(
    'moderation_flag_update',
    v_actor_id,
    'moderation_flag',
    p_flag_id::text,
    jsonb_build_object(
      'flag_id', p_flag_id,
      'previous_status', v_prev_status,
      'new_status', v_status,
      'target_type', v_target_type,
      'target_id', v_target_id,
      'admin_notes', NULLIF(trim(COALESCE(p_admin_notes, '')), '')
    ) || COALESCE(p_meta, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_take_moderation_case(
  p_flag_id uuid
)
RETURNS TABLE(ok boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_ops') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_flag_id IS NULL THEN
    RAISE EXCEPTION 'p_flag_id is required';
  END IF;

  PERFORM public.admin_update_moderation_flag(
    p_flag_id => p_flag_id,
    p_status => 'in_review',
    p_admin_notes => NULL::text,
    p_meta => jsonb_build_object('action', 'take_case')
  );

  RETURN QUERY SELECT true, 'case_taken'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hide_listing_and_resolve_flag(
  p_flag_id uuid,
  p_listing_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_has_column boolean;
  v_hidden boolean := false;
  v_existing_notes text;
  v_action_note text;
  v_next_notes text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_ops') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_flag_id IS NULL OR p_listing_id IS NULL THEN
    RAISE EXCEPTION 'p_flag_id and p_listing_id are required';
  END IF;

  SELECT mf.admin_notes
  INTO v_existing_notes
  FROM public.moderation_flags mf
  WHERE mf.id = p_flag_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Moderation flag not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'listings'
      AND column_name = 'is_published'
  ) INTO v_has_column;

  IF v_has_column THEN
    EXECUTE 'UPDATE public.listings SET is_published = false WHERE id = $1' USING p_listing_id;
    v_hidden := true;
  END IF;

  IF NOT v_hidden THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'listings'
        AND column_name = 'is_active'
    ) INTO v_has_column;

    IF v_has_column THEN
      EXECUTE 'UPDATE public.listings SET is_active = false WHERE id = $1' USING p_listing_id;
      v_hidden := true;
    END IF;
  END IF;

  IF NOT v_hidden THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'listings'
        AND column_name = 'deleted_at'
    ) INTO v_has_column;

    IF v_has_column THEN
      EXECUTE 'UPDATE public.listings SET deleted_at = now() WHERE id = $1' USING p_listing_id;
      v_hidden := true;
    END IF;
  END IF;

  v_action_note := '[' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ||
    '] Listing moderation action: hidden and resolved.';
  IF NULLIF(trim(COALESCE(p_notes, '')), '') IS NOT NULL THEN
    v_action_note := v_action_note || E'\nNotes: ' || trim(COALESCE(p_notes, ''));
  END IF;

  v_next_notes := concat_ws(
    E'\n\n',
    NULLIF(trim(COALESCE(v_existing_notes, '')), ''),
    v_action_note
  );

  PERFORM public.admin_update_moderation_flag(
    p_flag_id => p_flag_id,
    p_status => 'resolved',
    p_admin_notes => v_next_notes,
    p_meta => jsonb_build_object(
      'action', 'hide_listing_and_resolve_flag',
      'listing_id', p_listing_id,
      'listing_hidden', v_hidden
    )
  );

  PERFORM public.log_admin_action(
    'moderation_hide_listing',
    v_actor_id,
    'listing',
    p_listing_id::text,
    jsonb_build_object(
      'flag_id', p_flag_id,
      'listing_id', p_listing_id,
      'listing_hidden', v_hidden,
      'notes', NULLIF(trim(COALESCE(p_notes, '')), '')
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hide_review_and_resolve_flag(
  p_flag_id uuid,
  p_review_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_has_column boolean;
  v_hidden boolean := false;
  v_existing_notes text;
  v_action_note text;
  v_next_notes text;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_admin_role('admin_ops') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_flag_id IS NULL OR p_review_id IS NULL THEN
    RAISE EXCEPTION 'p_flag_id and p_review_id are required';
  END IF;

  SELECT mf.admin_notes
  INTO v_existing_notes
  FROM public.moderation_flags mf
  WHERE mf.id = p_flag_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Moderation flag not found';
  END IF;

  IF to_regclass('public.business_reviews') IS NULL THEN
    RAISE EXCEPTION 'business_reviews table not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_reviews'
      AND column_name = 'is_hidden'
  ) INTO v_has_column;

  IF v_has_column THEN
    EXECUTE 'UPDATE public.business_reviews SET is_hidden = true WHERE id = $1' USING p_review_id;
    v_hidden := true;
  END IF;

  IF NOT v_hidden THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'business_reviews'
        AND column_name = 'is_published'
    ) INTO v_has_column;

    IF v_has_column THEN
      EXECUTE 'UPDATE public.business_reviews SET is_published = false WHERE id = $1' USING p_review_id;
      v_hidden := true;
    END IF;
  END IF;

  IF NOT v_hidden THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'business_reviews'
        AND column_name = 'is_active'
    ) INTO v_has_column;

    IF v_has_column THEN
      EXECUTE 'UPDATE public.business_reviews SET is_active = false WHERE id = $1' USING p_review_id;
      v_hidden := true;
    END IF;
  END IF;

  IF NOT v_hidden THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'business_reviews'
        AND column_name = 'deleted_at'
    ) INTO v_has_column;

    IF v_has_column THEN
      EXECUTE 'UPDATE public.business_reviews SET deleted_at = now() WHERE id = $1' USING p_review_id;
      v_hidden := true;
    END IF;
  END IF;

  v_action_note := '[' || to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') ||
    '] Review moderation action: hidden and resolved.';
  IF NULLIF(trim(COALESCE(p_notes, '')), '') IS NOT NULL THEN
    v_action_note := v_action_note || E'\nNotes: ' || trim(COALESCE(p_notes, ''));
  END IF;

  v_next_notes := concat_ws(
    E'\n\n',
    NULLIF(trim(COALESCE(v_existing_notes, '')), ''),
    v_action_note
  );

  PERFORM public.admin_update_moderation_flag(
    p_flag_id => p_flag_id,
    p_status => 'resolved',
    p_admin_notes => v_next_notes,
    p_meta => jsonb_build_object(
      'action', 'hide_review_and_resolve_flag',
      'review_id', p_review_id,
      'review_hidden', v_hidden
    )
  );

  PERFORM public.log_admin_action(
    'moderation_hide_review',
    v_actor_id,
    'review',
    p_review_id::text,
    jsonb_build_object(
      'flag_id', p_flag_id,
      'review_id', p_review_id,
      'review_hidden', v_hidden,
      'notes', NULLIF(trim(COALESCE(p_notes, '')), '')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_moderation_flag(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_moderation_flag(uuid, text, text, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_take_moderation_case(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_take_moderation_case(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_hide_listing_and_resolve_flag(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_hide_listing_and_resolve_flag(uuid, uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_hide_review_and_resolve_flag(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_hide_review_and_resolve_flag(uuid, uuid, text) TO authenticated;
