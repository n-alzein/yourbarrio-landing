CREATE TABLE IF NOT EXISTS public.saved_businesses (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  business_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.saved_businesses OWNER TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_businesses_pkey'
  ) THEN
    ALTER TABLE public.saved_businesses
      ADD CONSTRAINT saved_businesses_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_businesses_user_id_fkey'
  ) THEN
    ALTER TABLE public.saved_businesses
      ADD CONSTRAINT saved_businesses_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'saved_businesses_business_id_fkey'
  ) THEN
    ALTER TABLE public.saved_businesses
      ADD CONSTRAINT saved_businesses_business_id_fkey
      FOREIGN KEY (business_id) REFERENCES public.businesses(owner_user_id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE UNIQUE INDEX IF NOT EXISTS saved_businesses_user_business_key
  ON public.saved_businesses (user_id, business_id);

CREATE INDEX IF NOT EXISTS saved_businesses_user_id_idx
  ON public.saved_businesses (user_id);

ALTER TABLE public.saved_businesses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_businesses'
      AND policyname = 'User can view saved businesses'
  ) THEN
    CREATE POLICY "User can view saved businesses"
      ON public.saved_businesses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_businesses'
      AND policyname = 'User can insert saved businesses'
  ) THEN
    CREATE POLICY "User can insert saved businesses"
      ON public.saved_businesses FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'saved_businesses'
      AND policyname = 'User can delete saved businesses'
  ) THEN
    CREATE POLICY "User can delete saved businesses"
      ON public.saved_businesses FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END$$;
