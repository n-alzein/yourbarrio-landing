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

ALTER TABLE public.admin_user_notes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS set_admin_user_notes_updated_at ON public.admin_user_notes;
CREATE TRIGGER set_admin_user_notes_updated_at
BEFORE UPDATE ON public.admin_user_notes
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_user_notes'
      AND policyname = 'Support ops super can update own notes'
  ) THEN
    CREATE POLICY "Support ops super can update own notes"
      ON public.admin_user_notes
      FOR UPDATE
      TO authenticated
      USING (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_support','admin_ops','admin_super']::text[])
        AND actor_user_id = auth.uid()
      )
      WITH CHECK (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_support','admin_ops','admin_super']::text[])
        AND actor_user_id = auth.uid()
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
      AND policyname = 'Support ops super can delete own notes; super can delete any'
  ) THEN
    CREATE POLICY "Support ops super can delete own notes; super can delete any"
      ON public.admin_user_notes
      FOR DELETE
      TO authenticated
      USING (
        public.is_admin_any_role(auth.uid(), ARRAY['admin_support','admin_ops','admin_super']::text[])
        AND (
          actor_user_id = auth.uid()
          OR public.is_admin_any_role(auth.uid(), ARRAY['admin_super']::text[])
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_update_user_note(
  p_note_id uuid,
  p_note text
)
RETURNS TABLE (
  id uuid,
  target_user_id uuid,
  actor_user_id uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_note text;
  v_row public.admin_user_notes%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_any_role(v_actor_id, ARRAY['admin_support','admin_ops','admin_super']::text[]) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_note_id IS NULL THEN
    RAISE EXCEPTION 'p_note_id is required';
  END IF;

  v_note := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note IS NULL THEN
    RAISE EXCEPTION 'p_note is required';
  END IF;

  SELECT n.* INTO v_row
  FROM public.admin_user_notes AS n
  WHERE n.id = p_note_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  IF v_row.actor_user_id <> v_actor_id THEN
    RAISE EXCEPTION 'Only the author can edit this note';
  END IF;

  UPDATE public.admin_user_notes AS n
  SET note = v_note
  WHERE n.id = p_note_id
  RETURNING n.* INTO v_row;

  PERFORM public.log_admin_action(
    p_action => 'user_internal_note_updated',
    p_target_type => 'user',
    p_target_id => v_row.target_user_id::text,
    p_meta => jsonb_build_object(
      'admin_user_note_id', v_row.id
    ),
    p_actor_user_id => v_actor_id
  );

  RETURN QUERY
  SELECT v_row.id, v_row.target_user_id, v_row.actor_user_id, v_row.note, v_row.created_at, v_row.updated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user_note(
  p_note_id uuid
)
RETURNS TABLE (
  id uuid,
  target_user_id uuid,
  actor_user_id uuid,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid;
  v_is_super boolean;
  v_row public.admin_user_notes%ROWTYPE;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_admin_any_role(v_actor_id, ARRAY['admin_support','admin_ops','admin_super']::text[]) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  IF p_note_id IS NULL THEN
    RAISE EXCEPTION 'p_note_id is required';
  END IF;

  v_is_super := public.is_admin_any_role(v_actor_id, ARRAY['admin_super']::text[]);

  SELECT n.* INTO v_row
  FROM public.admin_user_notes AS n
  WHERE n.id = p_note_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Note not found';
  END IF;

  IF (v_row.actor_user_id <> v_actor_id) AND (NOT v_is_super) THEN
    RAISE EXCEPTION 'Only the author or super admin can delete this note';
  END IF;

  DELETE FROM public.admin_user_notes AS n
  WHERE n.id = p_note_id;

  PERFORM public.log_admin_action(
    p_action => 'user_internal_note_deleted',
    p_target_type => 'user',
    p_target_id => v_row.target_user_id::text,
    p_meta => jsonb_build_object(
      'admin_user_note_id', v_row.id,
      'deleted_by_super', v_is_super AND (v_row.actor_user_id <> v_actor_id)
    ),
    p_actor_user_id => v_actor_id
  );

  RETURN QUERY
  SELECT v_row.id, v_row.target_user_id, v_row.actor_user_id, v_row.note, v_row.created_at, v_row.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_note(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_user_note(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_delete_user_note(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_user_note(uuid) TO authenticated;
