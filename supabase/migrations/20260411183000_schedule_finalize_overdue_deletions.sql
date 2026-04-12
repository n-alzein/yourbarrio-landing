SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE OR REPLACE FUNCTION public.invoke_finalize_overdue_deletions(
  p_source text DEFAULT 'pg_cron',
  p_limit integer DEFAULT 25
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_project_url text;
  v_bearer_token text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret
  INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'project_url'
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_bearer_token
  FROM vault.decrypted_secrets
  WHERE name = 'account_deletion_finalizer_token'
  LIMIT 1;

  IF v_project_url IS NULL OR btrim(v_project_url) = '' THEN
    RAISE EXCEPTION 'Missing Vault secret "project_url"';
  END IF;

  IF v_bearer_token IS NULL OR btrim(v_bearer_token) = '' THEN
    RAISE EXCEPTION 'Missing Vault secret "account_deletion_finalizer_token"';
  END IF;

  SELECT net.http_post(
    url := regexp_replace(v_project_url, '/+$', '') || '/functions/v1/finalize-overdue-deletions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_bearer_token
    ),
    body := jsonb_build_object(
      'source', COALESCE(NULLIF(btrim(p_source), ''), 'pg_cron'),
      'limit', GREATEST(1, LEAST(COALESCE(p_limit, 25), 100))
    )
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_finalize_overdue_deletions_job()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job record;
  v_removed integer := 0;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'finalize-overdue-deletions-daily'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
    v_removed := v_removed + 1;
  END LOOP;

  RETURN v_removed;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_finalize_overdue_deletions_job(
  p_schedule text DEFAULT '0 3 * * *'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  PERFORM public.unschedule_finalize_overdue_deletions_job();

  SELECT cron.schedule(
    'finalize-overdue-deletions-daily',
    p_schedule,
    $cron$SELECT public.invoke_finalize_overdue_deletions('pg_cron', 25);$cron$
  )
  INTO v_job_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_finalize_overdue_deletions_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jobid,
    jobname,
    schedule,
    active,
    command
  FROM cron.job
  WHERE jobname = 'finalize-overdue-deletions-daily'
  ORDER BY jobid DESC;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'project_url'
  ) AND EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'account_deletion_finalizer_token'
  ) THEN
    PERFORM public.schedule_finalize_overdue_deletions_job();
  ELSE
    RAISE NOTICE 'Skipping finalize-overdue-deletions cron schedule because required Vault secrets are missing.';
  END IF;
END;
$$;