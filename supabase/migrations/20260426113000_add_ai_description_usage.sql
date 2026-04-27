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

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.ai_description_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  surface text NOT NULL,
  target_id uuid NULL,
  action text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NULL,
  completion_tokens integer NULL,
  total_tokens integer NULL,
  estimated_cost_cents numeric(10,4) NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_description_usage_surface_valid'
      AND conrelid = 'public.ai_description_usage'::regclass
  ) THEN
    ALTER TABLE public.ai_description_usage
      ADD CONSTRAINT ai_description_usage_surface_valid
      CHECK (surface IN ('onboarding', 'listing-editor', 'business-profile'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_description_usage_action_valid'
      AND conrelid = 'public.ai_description_usage'::regclass
  ) THEN
    ALTER TABLE public.ai_description_usage
      ADD CONSTRAINT ai_description_usage_action_valid
      CHECK (action IN ('generate', 'regenerate', 'make_shorter', 'more_premium'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_description_usage_business_created_idx
  ON public.ai_description_usage (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_description_usage_user_created_idx
  ON public.ai_description_usage (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_description_usage_surface_created_idx
  ON public.ai_description_usage (surface, created_at DESC);

ALTER TABLE public.ai_description_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business members can read own ai description usage" ON public.ai_description_usage;
CREATE POLICY "Business members can read own ai description usage"
  ON public.ai_description_usage
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.businesses b
      LEFT JOIN public.vendor_members vm
        ON vm.user_id = auth.uid()
       AND (
         vm.business_entity_id = b.id
         OR (vm.business_entity_id IS NULL AND vm.vendor_id = b.owner_user_id)
       )
      WHERE b.id = ai_description_usage.business_id
        AND (b.owner_user_id = auth.uid() OR vm.id IS NOT NULL)
    )
  );

REVOKE ALL ON TABLE public.ai_description_usage FROM anon, authenticated;
GRANT SELECT ON TABLE public.ai_description_usage TO authenticated;
GRANT INSERT, SELECT ON TABLE public.ai_description_usage TO service_role;
