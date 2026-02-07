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

CREATE TABLE IF NOT EXISTS public.admin_roles (
    role_key text PRIMARY KEY,
    role_rank integer NOT NULL,
    description text,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.admin_roles (role_key, role_rank, description)
VALUES
    ('admin_readonly', 10, 'Read-only admin access'),
    ('admin_support', 20, 'Support tooling and impersonation'),
    ('admin_ops', 30, 'Operations and moderation actions'),
    ('admin_super', 40, 'Full platform administration')
ON CONFLICT (role_key) DO UPDATE
SET role_rank = EXCLUDED.role_rank,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.admin_role_members (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role_key text NOT NULL REFERENCES public.admin_roles(role_key) ON DELETE RESTRICT,
    granted_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_key)
);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    action text NOT NULL,
    target_type text,
    target_id text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    ended_at timestamptz,
    active boolean NOT NULL DEFAULT true,
    CONSTRAINT admin_impersonation_sessions_not_self CHECK (actor_user_id <> target_user_id)
);

CREATE TABLE IF NOT EXISTS public.moderation_flags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    target_business_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    reason text NOT NULL,
    details text,
    status text NOT NULL DEFAULT 'open',
    admin_notes text,
    reviewed_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT moderation_flags_status_valid CHECK (status IN ('open', 'triaged', 'resolved', 'dismissed'))
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    assigned_admin_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    subject text NOT NULL,
    body text,
    status text NOT NULL DEFAULT 'open',
    priority text NOT NULL DEFAULT 'normal',
    admin_notes text,
    meta jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,
    CONSTRAINT support_tickets_status_valid CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
    CONSTRAINT support_tickets_priority_valid CHECK (priority IN ('low', 'normal', 'high', 'urgent'))
);

CREATE INDEX IF NOT EXISTS idx_admin_role_members_user_id ON public.admin_role_members(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_role_members_role_key ON public.admin_role_members(role_key);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at_desc ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor_created_at ON public.admin_audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at ON public.admin_audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_actor_active ON public.admin_impersonation_sessions(actor_user_id, active, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_target_active ON public.admin_impersonation_sessions(target_user_id, active, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_expires_at ON public.admin_impersonation_sessions(expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_status_created_at ON public.moderation_flags(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_moderation_flags_target_user ON public.moderation_flags(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status_priority ON public.support_tickets(status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_admin ON public.support_tickets(assigned_admin_user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.admin_role_rank(input_role text)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((
    SELECT role_rank
    FROM public.admin_roles
    WHERE role_key = input_role
  ), -1);
$$;

CREATE OR REPLACE FUNCTION public.has_admin_role(required_role text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
  required_rank integer;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  required_rank := public.admin_role_rank(required_role);
  IF required_rank < 0 THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_role_members arm
    JOIN public.admin_roles ar ON ar.role_key = arm.role_key
    WHERE arm.user_id = current_user_id
      AND ar.role_rank >= required_rank
  ) THEN
    RETURN true;
  END IF;

  IF required_role = 'admin_readonly' AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = current_user_id
      AND (u.role = 'admin' OR COALESCE(u.is_internal, false) = true)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.admin_role_members arm
    WHERE arm.user_id = current_user_id
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = current_user_id
      AND (u.role = 'admin' OR COALESCE(u.is_internal, false) = true)
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_admin_role('admin_ops');
$$;

CREATE OR REPLACE FUNCTION public.count_new_users_last_days(p_days integer DEFAULT 7)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::bigint
  FROM public.users
  WHERE created_at >= now() - make_interval(days => GREATEST(COALESCE(p_days, 7), 1));
$$;

CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_meta jsonb DEFAULT '{}'::jsonb,
  p_actor_user_id uuid DEFAULT auth.uid()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_id uuid;
BEGIN
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'p_action is required';
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_user_id,
    action,
    target_type,
    target_id,
    meta
  ) VALUES (
    p_actor_user_id,
    p_action,
    p_target_type,
    p_target_id,
    COALESCE(p_meta, '{}'::jsonb)
  )
  RETURNING id INTO inserted_id;

  RETURN inserted_id;
END;
$$;

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

  ttl_minutes := GREATEST(COALESCE(minutes, 30), 1);

  INSERT INTO public.admin_impersonation_sessions (
    actor_user_id,
    target_user_id,
    reason,
    meta,
    expires_at,
    active
  ) VALUES (
    actor_id,
    target_user_id,
    reason,
    COALESCE(meta, '{}'::jsonb),
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
      'meta', COALESCE(meta, '{}'::jsonb)
    ),
    actor_id
  );

  RETURN inserted_id;
END;
$$;
