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

-- Compatibility wrapper for legacy caller order:
-- (p_action, p_actor_user_id, p_meta, p_target_id, p_target_type)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_actor_user_id uuid,
  p_meta jsonb,
  p_target_id uuid,
  p_target_type text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.log_admin_action(
    p_action => p_action,
    p_actor_user_id => p_actor_user_id,
    p_target_type => p_target_type,
    p_target_id => p_target_id::text,
    p_meta => COALESCE(p_meta, '{}'::jsonb)
  );
$$;

-- Compatibility wrapper for UUID target_id with canonical logical order:
-- (p_action, p_actor_user_id, p_target_type, p_target_id, p_meta)
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_actor_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_meta jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.log_admin_action(
    p_action => p_action,
    p_actor_user_id => p_actor_user_id,
    p_target_type => p_target_type,
    p_target_id => p_target_id::text,
    p_meta => COALESCE(p_meta, '{}'::jsonb)
  );
$$;
