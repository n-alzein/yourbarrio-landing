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
  IF to_regprocedure('public.is_admin_any_role(uuid,text[])') IS NULL THEN
    EXECUTE $sql$
      CREATE FUNCTION public.is_admin_any_role(p_user_id uuid, p_roles text[])
      RETURNS boolean
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = public
      AS $is_admin_any_role$
        SELECT EXISTS (
          SELECT 1
          FROM public.admin_role_members m
          WHERE m.user_id = p_user_id
            AND m.role_key = ANY (p_roles)
        );
      $is_admin_any_role$;
    $sql$;
  END IF;
END
$do$;

CREATE TABLE IF NOT EXISTS public.admin_user_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_target_created_at
  ON public.admin_user_notes (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_user_notes_actor_created_at
  ON public.admin_user_notes (actor_user_id, created_at DESC);

ALTER TABLE IF EXISTS public.admin_user_notes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_user_notes'
      AND policyname = 'Admin roles can read user notes'
  ) THEN
    CREATE POLICY "Admin roles can read user notes"
      ON public.admin_user_notes
      FOR SELECT
      TO authenticated
      USING (
        public.is_admin_any_role(
          auth.uid(),
          ARRAY['admin_readonly', 'admin_support', 'admin_ops', 'admin_super']::text[]
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_user_notes'
      AND policyname = 'Support ops super can insert user notes'
  ) THEN
    CREATE POLICY "Support ops super can insert user notes"
      ON public.admin_user_notes
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.is_admin_any_role(
          auth.uid(),
          ARRAY['admin_support', 'admin_ops', 'admin_super']::text[]
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_add_user_note(
  p_target_user_id uuid,
  p_note text
)
RETURNS TABLE (
  id uuid,
  target_user_id uuid,
  actor_user_id uuid,
  note text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_note text;
  v_inserted public.admin_user_notes%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_any_role(v_actor_id, ARRAY['admin_support', 'admin_ops', 'admin_super']::text[]) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'p_target_user_id is required';
  END IF;

  v_note := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'p_note is required';
  END IF;

  INSERT INTO public.admin_user_notes (
    target_user_id,
    actor_user_id,
    note
  ) VALUES (
    p_target_user_id,
    v_actor_id,
    v_note
  )
  RETURNING * INTO v_inserted;

  PERFORM public.log_admin_action(
    'user_internal_note_added',
    'user',
    p_target_user_id::text,
    jsonb_build_object(
      'note', v_note,
      'admin_user_note_id', v_inserted.id
    ),
    v_actor_id
  );

  RETURN QUERY
  SELECT
    v_inserted.id,
    v_inserted.target_user_id,
    v_inserted.actor_user_id,
    v_inserted.note,
    v_inserted.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_user_notes(
  p_target_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  target_user_id uuid,
  actor_user_id uuid,
  note text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_offset integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_any_role(auth.uid(), ARRAY['admin_readonly', 'admin_support', 'admin_ops', 'admin_super']::text[]) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'p_target_user_id is required';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  SELECT
    n.id,
    n.target_user_id,
    n.actor_user_id,
    n.note,
    n.created_at
  FROM public.admin_user_notes n
  WHERE n.target_user_id = p_target_user_id
  ORDER BY n.created_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_add_user_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_add_user_note(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_list_user_notes(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_user_notes(uuid, integer, integer) TO authenticated;
