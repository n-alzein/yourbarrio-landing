-- Inventory jobs + additional indexes

CREATE TABLE IF NOT EXISTS public.inventory_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
  progress int NOT NULL DEFAULT 0,
  payload jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS inventory_jobs_business_status_idx
  ON public.inventory_jobs (business_id, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS inventory_jobs_listing_idx
  ON public.inventory_jobs (listing_id);

-- Index to support newest-first message paging
CREATE INDEX IF NOT EXISTS messages_conversation_created_desc_idx
  ON public.messages (conversation_id, created_at DESC);

ALTER TABLE public.inventory_jobs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Businesses can read inventory jobs'
  ) THEN
    CREATE POLICY "Businesses can read inventory jobs"
      ON public.inventory_jobs FOR SELECT
      USING (auth.uid() = business_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Businesses can create inventory jobs'
  ) THEN
    CREATE POLICY "Businesses can create inventory jobs"
      ON public.inventory_jobs FOR INSERT
      WITH CHECK (auth.uid() = business_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Businesses can update inventory jobs'
  ) THEN
    CREATE POLICY "Businesses can update inventory jobs"
      ON public.inventory_jobs FOR UPDATE
      USING (auth.uid() = business_id);
  END IF;
END$$;
