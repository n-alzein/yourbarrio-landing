ALTER TABLE public.order_notifications
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS provider_message_id text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS provider_error_code text,
  ADD COLUMN IF NOT EXISTS provider_error_message text,
  ADD COLUMN IF NOT EXISTS last_provider_event_at timestamptz;

CREATE INDEX IF NOT EXISTS order_notifications_provider_message_id_idx
  ON public.order_notifications (provider_message_id);