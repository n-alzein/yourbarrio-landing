SET client_min_messages = warning;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS fulfillment_type text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS order_items jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS messages_order_status_update_idx
  ON public.messages (conversation_id, order_id, created_at)
  WHERE type = 'order_status_update';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END
$$;
