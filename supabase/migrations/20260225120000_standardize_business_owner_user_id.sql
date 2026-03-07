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

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'business_owner_id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.businesses
      SET owner_user_id = COALESCE(owner_user_id, business_owner_id)
      WHERE owner_user_id IS NULL
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'id'
  ) THEN
    EXECUTE $sql$
      UPDATE public.businesses b
      SET owner_user_id = b.id
      WHERE b.owner_user_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM auth.users au
          WHERE au.id = b.id
        )
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'businesses_owner_user_id_fkey'
      AND conrelid = 'public.businesses'::regclass
  ) THEN
    ALTER TABLE public.businesses
      ADD CONSTRAINT businesses_owner_user_id_fkey
      FOREIGN KEY (owner_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS businesses_owner_user_id_idx
  ON public.businesses (owner_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS businesses_owner_user_id_key
  ON public.businesses (owner_user_id)
  WHERE owner_user_id IS NOT NULL;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Businesses can read own row" ON public.businesses;
CREATE POLICY "Businesses can read own row"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Businesses can insert own row" ON public.businesses;
CREATE POLICY "Businesses can insert own row"
  ON public.businesses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

DROP POLICY IF EXISTS "Businesses can update own row" ON public.businesses;
CREATE POLICY "Businesses can update own row"
  ON public.businesses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

