SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS order_alert_phone text,
  ADD COLUMN IF NOT EXISTS order_alert_phone_backup text,
  ADD COLUMN IF NOT EXISTS order_alert_email text,
  ADD COLUMN IF NOT EXISTS sms_opt_in boolean,
  ADD COLUMN IF NOT EXISTS order_alerts_enabled boolean,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

UPDATE public.businesses
SET order_alert_phone = COALESCE(order_alert_phone, phone)
WHERE order_alert_phone IS NULL
  AND NULLIF(btrim(phone), '') IS NOT NULL;

UPDATE public.businesses b
SET order_alert_email = COALESCE(b.order_alert_email, u.email)
FROM public.users u
WHERE u.id = b.owner_user_id
  AND b.order_alert_email IS NULL
  AND NULLIF(btrim(u.email), '') IS NOT NULL;

UPDATE public.businesses
SET sms_opt_in = true
WHERE sms_opt_in IS NULL;

UPDATE public.businesses
SET order_alerts_enabled = true
WHERE order_alerts_enabled IS NULL;

ALTER TABLE public.businesses
  ALTER COLUMN sms_opt_in SET DEFAULT true,
  ALTER COLUMN order_alerts_enabled SET DEFAULT true;

ALTER TABLE public.vendor_members
  ADD COLUMN IF NOT EXISTS business_entity_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_members_business_entity_id_fkey'
  ) THEN
    ALTER TABLE public.vendor_members
      ADD CONSTRAINT vendor_members_business_entity_id_fkey
      FOREIGN KEY (business_entity_id) REFERENCES public.businesses(id) ON DELETE CASCADE;
  END IF;
END $$;

UPDATE public.vendor_members vm
SET business_entity_id = b.id
FROM public.businesses b
WHERE vm.business_entity_id IS NULL
  AND b.owner_user_id = vm.vendor_id;

CREATE INDEX IF NOT EXISTS vendor_members_business_entity_id_idx
  ON public.vendor_members (business_entity_id);

CREATE INDEX IF NOT EXISTS vendor_members_business_entity_user_idx
  ON public.vendor_members (business_entity_id, user_id);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notification_state text,
  ADD COLUMN IF NOT EXISTS first_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_alert_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS escalation_level integer;

UPDATE public.orders
SET notification_state = 'pending'
WHERE notification_state IS NULL;

UPDATE public.orders
SET escalation_level = 0
WHERE escalation_level IS NULL;

ALTER TABLE public.orders
  ALTER COLUMN notification_state SET DEFAULT 'pending',
  ALTER COLUMN escalation_level SET DEFAULT 0,
  ALTER COLUMN escalation_level SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_acknowledged_by_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_acknowledged_by_fkey
      FOREIGN KEY (acknowledged_by) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_notification_state_idx
  ON public.orders (notification_state, acknowledged_at, first_alert_sent_at);

CREATE TABLE IF NOT EXISTS public.order_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_entity_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  channel text NOT NULL,
  notification_kind text NOT NULL,
  destination text NOT NULL,
  provider text,
  provider_message_id text,
  status text NOT NULL DEFAULT 'pending',
  attempt_number integer NOT NULL DEFAULT 1,
  idempotency_key text NOT NULL,
  error_code text,
  error_message text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  CONSTRAINT order_notifications_channel_valid
    CHECK (channel IN ('sms', 'email', 'call')),
  CONSTRAINT order_notifications_kind_valid
    CHECK (notification_kind IN ('new_order', 'reminder')),
  CONSTRAINT order_notifications_status_valid
    CHECK (status IN ('pending', 'sent', 'accepted', 'delivered', 'failed', 'undelivered', 'skipped'))
);

CREATE UNIQUE INDEX IF NOT EXISTS order_notifications_idempotency_key_key
  ON public.order_notifications (idempotency_key);

CREATE INDEX IF NOT EXISTS order_notifications_order_id_idx
  ON public.order_notifications (order_id);

CREATE INDEX IF NOT EXISTS order_notifications_owner_user_id_idx
  ON public.order_notifications (owner_user_id);

CREATE INDEX IF NOT EXISTS order_notifications_business_entity_id_idx
  ON public.order_notifications (business_entity_id);

CREATE INDEX IF NOT EXISTS order_notifications_provider_message_id_idx
  ON public.order_notifications (provider_message_id);

CREATE INDEX IF NOT EXISTS order_notifications_order_channel_kind_idx
  ON public.order_notifications (order_id, channel, notification_kind);

ALTER TABLE public.order_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses can read order notification logs" ON public.order_notifications;

CREATE POLICY "Businesses can read order notification logs"
  ON public.order_notifications
  FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IS NOT NULL
    AND (
      owner_user_id = (select auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.vendor_members vm
        WHERE vm.business_entity_id = order_notifications.business_entity_id
          AND vm.user_id = (select auth.uid())
      )
    )
  );

CREATE OR REPLACE FUNCTION public.set_order_notification_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_notifications_set_updated_at ON public.order_notifications;
CREATE TRIGGER order_notifications_set_updated_at
BEFORE UPDATE ON public.order_notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_order_notification_updated_at();

CREATE OR REPLACE FUNCTION public.set_vendor_member_business_entity_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.business_entity_id IS NULL AND NEW.vendor_id IS NOT NULL THEN
    SELECT b.id
    INTO NEW.business_entity_id
    FROM public.businesses b
    WHERE b.owner_user_id = NEW.vendor_id
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_members_set_business_entity_id ON public.vendor_members;
CREATE TRIGGER vendor_members_set_business_entity_id
BEFORE INSERT OR UPDATE OF vendor_id, business_entity_id ON public.vendor_members
FOR EACH ROW
EXECUTE FUNCTION public.set_vendor_member_business_entity_id();

CREATE OR REPLACE FUNCTION public.try_acquire_order_notification_reminders_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(hashtext('order_notification_reminders'));
$$;

CREATE OR REPLACE FUNCTION public.release_order_notification_reminders_lock()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(hashtext('order_notification_reminders'));
$$;

CREATE OR REPLACE FUNCTION public.invoke_order_notification_reminders(
  p_source text DEFAULT 'pg_cron',
  p_limit integer DEFAULT 50
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  v_app_url text;
  v_bearer_token text;
  v_request_id bigint;
BEGIN
  SELECT decrypted_secret
  INTO v_app_url
  FROM vault.decrypted_secrets
  WHERE name = 'app_url'
  LIMIT 1;

  SELECT decrypted_secret
  INTO v_bearer_token
  FROM vault.decrypted_secrets
  WHERE name = 'order_notification_reminder_token'
  LIMIT 1;

  IF v_app_url IS NULL OR btrim(v_app_url) = '' THEN
    RAISE EXCEPTION 'Missing Vault secret "app_url"';
  END IF;

  IF v_bearer_token IS NULL OR btrim(v_bearer_token) = '' THEN
    RAISE EXCEPTION 'Missing Vault secret "order_notification_reminder_token"';
  END IF;

  SELECT net.http_post(
    url := regexp_replace(v_app_url, '/+$', '') || '/api/internal/order-notification-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_bearer_token
    ),
    body := jsonb_build_object(
      'source', COALESCE(NULLIF(btrim(p_source), ''), 'pg_cron'),
      'limit', GREATEST(1, LEAST(COALESCE(p_limit, 50), 250))
    )
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_order_notification_reminders_job()
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
    WHERE jobname = 'order-notification-reminders-every-minute'
  LOOP
    PERFORM cron.unschedule(v_job.jobid);
    v_removed := v_removed + 1;
  END LOOP;

  RETURN v_removed;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_order_notification_reminders_job(
  p_schedule text DEFAULT '* * * * *'
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id bigint;
BEGIN
  PERFORM public.unschedule_order_notification_reminders_job();

  SELECT cron.schedule(
    'order-notification-reminders-every-minute',
    p_schedule,
    $cron$SELECT public.invoke_order_notification_reminders('pg_cron', 50);$cron$
  )
  INTO v_job_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_order_notification_reminder_jobs()
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
  WHERE jobname = 'order-notification-reminders-every-minute'
  ORDER BY jobid DESC;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'app_url'
  ) AND EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'order_notification_reminder_token'
  ) THEN
    PERFORM public.schedule_order_notification_reminders_job();
  ELSE
    RAISE NOTICE 'Skipping order notification reminder cron schedule because required Vault secrets are missing.';
  END IF;
END;
$$;
