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

CREATE TABLE IF NOT EXISTS public.monetization_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  is_public boolean NOT NULL DEFAULT false,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  billing_model text NOT NULL CHECK (billing_model IN ('free', 'founding', 'subscription', 'custom', 'manual')),
  monthly_price_cents integer,
  annual_price_cents integer,
  currency text NOT NULL DEFAULT 'usd',
  stripe_product_id text,
  stripe_monthly_price_id text,
  stripe_annual_price_id text,
  stripe_lookup_key text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monetization_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  value_type text NOT NULL CHECK (value_type IN ('boolean', 'integer', 'decimal', 'text', 'json')),
  category text NOT NULL,
  default_value jsonb,
  unit text,
  is_metered boolean NOT NULL DEFAULT false,
  reset_interval text CHECK (reset_interval IS NULL OR reset_interval IN ('monthly', 'daily', 'weekly', 'annual')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.monetization_plan_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.monetization_plans(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.monetization_features(id) ON DELETE CASCADE,
  value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_id)
);

CREATE TABLE IF NOT EXISTS public.business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.monetization_plans(id),
  status text NOT NULL CHECK (status IN ('founding', 'free', 'trialing', 'active', 'past_due', 'canceled', 'paused', 'comped', 'manual')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'stripe', 'migration', 'admin', 'system')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_subscription_item_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  founding_started_at timestamptz,
  founding_ends_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS business_subscriptions_stripe_customer_key
  ON public.business_subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS business_subscriptions_stripe_subscription_key
  ON public.business_subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.business_entitlement_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.monetization_features(id) ON DELETE CASCADE,
  override_type text NOT NULL CHECK (override_type IN ('grant', 'deny', 'set_limit', 'increase_limit')),
  value jsonb,
  reason text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS business_entitlement_overrides_business_feature_idx
  ON public.business_entitlement_overrides (business_id, feature_id, active);

CREATE TABLE IF NOT EXISTS public.business_feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  feature_id uuid NOT NULL REFERENCES public.monetization_features(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  used_count integer NOT NULL DEFAULT 0,
  reserved_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, feature_id, period_start, period_end),
  CHECK (period_end > period_start),
  CHECK (used_count >= 0),
  CHECK (reserved_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.monetization_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE SET NULL,
  actor_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_source text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monetization_audit_events_business_created_idx
  ON public.monetization_audit_events (business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  processed_at timestamptz,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')),
  error_message text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.monetization_plans
  (key, name, description, billing_model, is_public, is_default, sort_order)
VALUES
  ('founding_business', 'Founding Business', 'Internal beta/founding plan. Free during beta.', 'founding', false, true, 10),
  ('free', 'Free', 'Future self-serve limited plan.', 'free', false, false, 20),
  ('starter', 'Starter', 'Future paid plan for basic marketplace tools.', 'subscription', false, false, 30),
  ('pro', 'Pro', 'Future paid plan for visibility, analytics, and higher limits.', 'subscription', false, false, 40),
  ('premium', 'Premium', 'Future paid plan for high-volume or promoted businesses.', 'subscription', false, false, 50),
  ('custom', 'Custom', 'Manual enterprise/local-partner plan controlled by admin.', 'custom', false, false, 60)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  billing_model = EXCLUDED.billing_model,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

UPDATE public.monetization_plans
SET is_default = (key = 'founding_business');

INSERT INTO public.monetization_features
  (key, name, value_type, category, default_value, unit, is_metered, reset_interval)
VALUES
  ('inventory.online_stock', 'Online stock inventory', 'boolean', 'inventory', 'true', NULL, false, NULL),
  ('inventory.unique_items', 'Unique-item inventory', 'boolean', 'inventory', 'false', NULL, false, NULL),
  ('inventory.external_pos', 'External POS inventory', 'boolean', 'inventory', 'false', NULL, false, NULL),
  ('inventory.capacity_based', 'Capacity-based inventory', 'boolean', 'inventory', 'false', NULL, false, NULL),
  ('listings.active_limit', 'Active listings limit', 'integer', 'listings', '10', 'listings', false, NULL),
  ('listings.images_per_listing_limit', 'Images per listing limit', 'integer', 'listings', '5', 'images', false, NULL),
  ('ai.photo_enhancement', 'AI photo enhancement', 'boolean', 'ai', 'true', NULL, false, NULL),
  ('ai.photo_enhancement.monthly_limit', 'AI photo enhancement monthly limit', 'integer', 'ai', '20', 'uses', true, 'monthly'),
  ('ai.description_generation', 'AI description generation', 'boolean', 'ai', 'true', NULL, false, NULL),
  ('ai.description_generation.monthly_limit', 'AI description generation monthly limit', 'integer', 'ai', '20', 'uses', true, 'monthly'),
  ('analytics.basic', 'Basic analytics', 'boolean', 'analytics', 'true', NULL, false, NULL),
  ('analytics.advanced', 'Advanced analytics', 'boolean', 'analytics', 'false', NULL, false, NULL),
  ('orders.online_checkout', 'Online checkout', 'boolean', 'orders', 'true', NULL, false, NULL),
  ('orders.request_to_buy', 'Request to buy', 'boolean', 'orders', 'true', NULL, false, NULL),
  ('orders.business_confirmation_required', 'Business confirmation required', 'boolean', 'orders', 'false', NULL, false, NULL),
  ('messaging.customer_business', 'Customer-business messaging', 'boolean', 'messaging', 'true', NULL, false, NULL),
  ('featured_placement', 'Featured placement', 'boolean', 'promotions', 'false', NULL, false, NULL),
  ('featured_placement.monthly_credits', 'Featured placement monthly credits', 'integer', 'promotions', '0', 'credits', true, 'monthly'),
  ('promotions.self_serve', 'Self-serve promotions', 'boolean', 'promotions', 'false', NULL, false, NULL),
  ('team.members_limit', 'Team members limit', 'integer', 'team', '1', 'members', false, NULL),
  ('storefront.customization', 'Storefront customization', 'boolean', 'storefront', 'false', NULL, false, NULL),
  ('support.priority', 'Priority support', 'boolean', 'support', 'false', NULL, false, NULL),
  ('marketplace.take_rate_percent', 'Marketplace take rate percent', 'decimal', 'billing', '0', 'percent', false, NULL),
  ('marketplace.fixed_fee_cents', 'Marketplace fixed fee cents', 'integer', 'billing', '0', 'cents', false, NULL)
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  value_type = EXCLUDED.value_type,
  category = EXCLUDED.category,
  default_value = EXCLUDED.default_value,
  unit = EXCLUDED.unit,
  is_metered = EXCLUDED.is_metered,
  reset_interval = EXCLUDED.reset_interval,
  updated_at = now();

WITH plan_values(plan_key, entitlements) AS (
  VALUES
  ('founding_business', '{"inventory.online_stock":true,"inventory.unique_items":true,"inventory.external_pos":false,"inventory.capacity_based":false,"listings.active_limit":50,"listings.images_per_listing_limit":8,"ai.photo_enhancement":true,"ai.photo_enhancement.monthly_limit":100,"ai.description_generation":true,"ai.description_generation.monthly_limit":100,"analytics.basic":true,"analytics.advanced":false,"orders.online_checkout":true,"orders.request_to_buy":true,"orders.business_confirmation_required":false,"messaging.customer_business":true,"featured_placement":true,"featured_placement.monthly_credits":5,"promotions.self_serve":false,"team.members_limit":3,"storefront.customization":true,"support.priority":false,"marketplace.take_rate_percent":0,"marketplace.fixed_fee_cents":0}'::jsonb),
  ('free', '{"inventory.online_stock":true,"inventory.unique_items":false,"inventory.external_pos":false,"inventory.capacity_based":false,"listings.active_limit":10,"listings.images_per_listing_limit":5,"ai.photo_enhancement":true,"ai.photo_enhancement.monthly_limit":20,"ai.description_generation":true,"ai.description_generation.monthly_limit":20,"analytics.basic":true,"analytics.advanced":false,"orders.online_checkout":true,"orders.request_to_buy":true,"orders.business_confirmation_required":false,"messaging.customer_business":true,"featured_placement":false,"featured_placement.monthly_credits":0,"promotions.self_serve":false,"team.members_limit":1,"storefront.customization":false,"support.priority":false,"marketplace.take_rate_percent":0,"marketplace.fixed_fee_cents":0}'::jsonb),
  ('starter', '{"inventory.online_stock":true,"inventory.unique_items":true,"inventory.external_pos":false,"inventory.capacity_based":false,"listings.active_limit":50,"listings.images_per_listing_limit":8,"ai.photo_enhancement":true,"ai.photo_enhancement.monthly_limit":100,"ai.description_generation":true,"ai.description_generation.monthly_limit":100,"analytics.basic":true,"analytics.advanced":false,"orders.online_checkout":true,"orders.request_to_buy":true,"orders.business_confirmation_required":false,"messaging.customer_business":true,"featured_placement":false,"featured_placement.monthly_credits":0,"promotions.self_serve":false,"team.members_limit":3,"storefront.customization":true,"support.priority":false,"marketplace.take_rate_percent":0,"marketplace.fixed_fee_cents":0}'::jsonb),
  ('pro', '{"inventory.online_stock":true,"inventory.unique_items":true,"inventory.external_pos":true,"inventory.capacity_based":false,"listings.active_limit":150,"listings.images_per_listing_limit":12,"ai.photo_enhancement":true,"ai.photo_enhancement.monthly_limit":300,"ai.description_generation":true,"ai.description_generation.monthly_limit":300,"analytics.basic":true,"analytics.advanced":true,"orders.online_checkout":true,"orders.request_to_buy":true,"orders.business_confirmation_required":false,"messaging.customer_business":true,"featured_placement":true,"featured_placement.monthly_credits":15,"promotions.self_serve":false,"team.members_limit":8,"storefront.customization":true,"support.priority":false,"marketplace.take_rate_percent":0,"marketplace.fixed_fee_cents":0}'::jsonb),
  ('premium', '{"inventory.online_stock":true,"inventory.unique_items":true,"inventory.external_pos":true,"inventory.capacity_based":true,"listings.active_limit":500,"listings.images_per_listing_limit":20,"ai.photo_enhancement":true,"ai.photo_enhancement.monthly_limit":1000,"ai.description_generation":true,"ai.description_generation.monthly_limit":1000,"analytics.basic":true,"analytics.advanced":true,"orders.online_checkout":true,"orders.request_to_buy":true,"orders.business_confirmation_required":false,"messaging.customer_business":true,"featured_placement":true,"featured_placement.monthly_credits":50,"promotions.self_serve":true,"team.members_limit":20,"storefront.customization":true,"support.priority":true,"marketplace.take_rate_percent":0,"marketplace.fixed_fee_cents":0}'::jsonb),
  ('custom', '{"inventory.online_stock":true,"inventory.unique_items":true,"inventory.external_pos":true,"inventory.capacity_based":true,"listings.active_limit":500,"listings.images_per_listing_limit":20,"ai.photo_enhancement":true,"ai.photo_enhancement.monthly_limit":1000,"ai.description_generation":true,"ai.description_generation.monthly_limit":1000,"analytics.basic":true,"analytics.advanced":true,"orders.online_checkout":true,"orders.request_to_buy":true,"orders.business_confirmation_required":false,"messaging.customer_business":true,"featured_placement":true,"featured_placement.monthly_credits":50,"promotions.self_serve":true,"team.members_limit":20,"storefront.customization":true,"support.priority":true,"marketplace.take_rate_percent":0,"marketplace.fixed_fee_cents":0}'::jsonb)
),
expanded AS (
  SELECT p.id AS plan_id, f.id AS feature_id, item.value
  FROM plan_values pv
  JOIN public.monetization_plans p ON p.key = pv.plan_key
  JOIN LATERAL jsonb_each(pv.entitlements) AS item(key, value) ON true
  JOIN public.monetization_features f ON f.key = item.key
)
INSERT INTO public.monetization_plan_entitlements (plan_id, feature_id, value)
SELECT plan_id, feature_id, value FROM expanded
ON CONFLICT (plan_id, feature_id) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

INSERT INTO public.business_subscriptions
  (business_id, plan_id, status, source, founding_started_at)
SELECT b.id, p.id, 'founding', 'migration', now()
FROM public.businesses b
CROSS JOIN public.monetization_plans p
WHERE p.key = 'founding_business'
  AND NOT EXISTS (
    SELECT 1 FROM public.business_subscriptions bs WHERE bs.business_id = b.id
  );

CREATE OR REPLACE FUNCTION public.assign_default_business_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  SELECT id INTO v_plan_id FROM public.monetization_plans WHERE key = 'founding_business';
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.business_subscriptions (business_id, plan_id, status, source, founding_started_at)
    VALUES (NEW.id, v_plan_id, 'founding', 'system', now())
    ON CONFLICT (business_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_assign_default_subscription ON public.businesses;
CREATE TRIGGER businesses_assign_default_subscription
AFTER INSERT ON public.businesses
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_business_subscription();

CREATE OR REPLACE FUNCTION public.consume_business_feature_usage(
  p_business_id uuid,
  p_feature_key text,
  p_amount integer,
  p_period_start date,
  p_period_end date,
  p_limit integer DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature_id uuid;
  v_current integer;
  v_amount integer := greatest(1, coalesce(p_amount, 1));
BEGIN
  SELECT id INTO v_feature_id FROM public.monetization_features WHERE key = p_feature_key;
  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Unknown monetization feature: %', p_feature_key;
  END IF;

  INSERT INTO public.business_feature_usage (
    business_id, feature_id, period_start, period_end, used_count, reserved_count, metadata
  )
  VALUES (p_business_id, v_feature_id, p_period_start, p_period_end, 0, 0, p_metadata)
  ON CONFLICT (business_id, feature_id, period_start, period_end) DO NOTHING;

  SELECT used_count + reserved_count
  INTO v_current
  FROM public.business_feature_usage
  WHERE business_id = p_business_id
    AND feature_id = v_feature_id
    AND period_start = p_period_start
    AND period_end = p_period_end
  FOR UPDATE;

  IF p_limit IS NOT NULL AND v_current + v_amount > p_limit THEN
    RETURN false;
  END IF;

  UPDATE public.business_feature_usage
  SET used_count = used_count + v_amount,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = now()
  WHERE business_id = p_business_id
    AND feature_id = v_feature_id
    AND period_start = p_period_start
    AND period_end = p_period_end;

  INSERT INTO public.monetization_audit_events (business_id, event_type, event_source, payload)
  VALUES (
    p_business_id,
    'usage.consumed',
    'system',
    jsonb_build_object('feature_key', p_feature_key, 'amount', v_amount, 'period_start', p_period_start, 'period_end', p_period_end)
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_business_numeric_entitlement(
  p_business_id uuid,
  p_feature_key text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_feature_id uuid;
  v_plan_id uuid;
  v_value jsonb;
  v_number numeric;
  v_increase numeric;
BEGIN
  SELECT id, default_value INTO v_feature_id, v_value
  FROM public.monetization_features
  WHERE key = p_feature_key;

  IF v_feature_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.business_entitlement_overrides
    WHERE business_id = p_business_id
      AND feature_id = v_feature_id
      AND active = true
      AND override_type = 'deny'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
  ) THEN
    RETURN 0;
  END IF;

  SELECT value INTO v_value
  FROM public.business_entitlement_overrides
  WHERE business_id = p_business_id
    AND feature_id = v_feature_id
    AND active = true
    AND override_type = 'set_limit'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_value IS NULL THEN
    SELECT bs.plan_id INTO v_plan_id
    FROM public.business_subscriptions bs
    WHERE bs.business_id = p_business_id;

    IF v_plan_id IS NULL THEN
      SELECT id INTO v_plan_id FROM public.monetization_plans WHERE key = 'founding_business';
    END IF;

    SELECT mpe.value INTO v_value
    FROM public.monetization_plan_entitlements mpe
    WHERE mpe.plan_id = v_plan_id
      AND mpe.feature_id = v_feature_id;
  END IF;

  v_number := NULLIF(trim(both '"' from coalesce(v_value::text, '')), '')::numeric;

  -- increase_limit is additive and intentionally stacks for manual credits or
  -- temporary limit bumps, including on top of set_limit.
  SELECT coalesce(sum(NULLIF(trim(both '"' from value::text), '')::numeric), 0)
  INTO v_increase
  FROM public.business_entitlement_overrides
  WHERE business_id = p_business_id
    AND feature_id = v_feature_id
    AND active = true
    AND override_type = 'increase_limit'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at > now());

  RETURN coalesce(v_number, 0) + coalesce(v_increase, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_business_active_listing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id uuid;
  v_limit integer;
  v_active_count integer;
BEGIN
  IF NEW.status IS DISTINCT FROM 'published' THEN
    RETURN NEW;
  END IF;

  -- Current listing ownership is legacy-shaped: listings.business_id stores the
  -- business owner user id, not businesses.id. Monetization tables use
  -- businesses.id, so this trigger resolves through businesses.owner_user_id.
  SELECT id INTO v_business_id FROM public.businesses WHERE owner_user_id = NEW.business_id LIMIT 1;
  IF v_business_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_limit := public.get_business_numeric_entitlement(v_business_id, 'listings.active_limit')::integer;
  IF v_limit IS NULL OR v_limit <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO v_active_count
  FROM public.listings
  WHERE business_id = NEW.business_id
    AND status = 'published'
    AND coalesce(admin_hidden, false) = false
    AND deleted_at IS NULL
    AND id IS DISTINCT FROM NEW.id;

  IF v_active_count >= v_limit THEN
    RAISE EXCEPTION 'Active listing limit reached for this business.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_enforce_active_listing_limit ON public.listings;
CREATE TRIGGER listings_enforce_active_listing_limit
BEFORE INSERT OR UPDATE OF status, admin_hidden, deleted_at ON public.listings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_business_active_listing_limit();

ALTER TABLE public.monetization_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_plan_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monetization_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read active monetization plans" ON public.monetization_plans;
CREATE POLICY "Authenticated users can read active monetization plans"
  ON public.monetization_plans FOR SELECT TO authenticated
  USING (status = 'active');

DROP POLICY IF EXISTS "Authenticated users can read active monetization features" ON public.monetization_features;
CREATE POLICY "Authenticated users can read active monetization features"
  ON public.monetization_features FOR SELECT TO authenticated
  USING (active = true);

DROP POLICY IF EXISTS "Authenticated users can read plan entitlements" ON public.monetization_plan_entitlements;
CREATE POLICY "Authenticated users can read plan entitlements"
  ON public.monetization_plan_entitlements FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.monetization_plans p
      WHERE p.id = monetization_plan_entitlements.plan_id
        AND p.is_public = true
        AND p.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.business_subscriptions bs
      JOIN public.businesses b ON b.id = bs.business_id
      WHERE bs.plan_id = monetization_plan_entitlements.plan_id
        AND b.owner_user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Business owners can read own subscription" ON public.business_subscriptions;
CREATE POLICY "Business owners can read own subscription"
  ON public.business_subscriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_subscriptions.business_id
        AND b.owner_user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Business owners can read own entitlement overrides" ON public.business_entitlement_overrides;
CREATE POLICY "Business owners can read own entitlement overrides"
  ON public.business_entitlement_overrides FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_entitlement_overrides.business_id
        AND b.owner_user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Business owners can read own feature usage" ON public.business_feature_usage;
CREATE POLICY "Business owners can read own feature usage"
  ON public.business_feature_usage FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = business_feature_usage.business_id
        AND b.owner_user_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can read monetization audit events" ON public.monetization_audit_events;
CREATE POLICY "Admins can read monetization audit events"
  ON public.monetization_audit_events FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT SELECT ON public.monetization_plans TO authenticated;
GRANT SELECT ON public.monetization_features TO authenticated;
GRANT SELECT ON public.monetization_plan_entitlements TO authenticated;
GRANT SELECT ON public.business_subscriptions TO authenticated;
GRANT SELECT ON public.business_entitlement_overrides TO authenticated;
GRANT SELECT ON public.business_feature_usage TO authenticated;

GRANT ALL ON public.monetization_plans TO service_role;
GRANT ALL ON public.monetization_features TO service_role;
GRANT ALL ON public.monetization_plan_entitlements TO service_role;
GRANT ALL ON public.business_subscriptions TO service_role;
GRANT ALL ON public.business_entitlement_overrides TO service_role;
GRANT ALL ON public.business_feature_usage TO service_role;
GRANT ALL ON public.monetization_audit_events TO service_role;
GRANT ALL ON public.stripe_webhook_events TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_business_feature_usage(uuid, text, integer, date, date, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_business_numeric_entitlement(uuid, text) TO service_role;
