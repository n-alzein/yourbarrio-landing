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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'set_row_updated_at'
      AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    CREATE FUNCTION public.set_row_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.listing_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'select',
  required boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listing_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.listing_attributes(id) ON DELETE CASCADE,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listing_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sku text NULL,
  price numeric(10,2) NULL,
  quantity integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.listing_variant_options (
  variant_id uuid NOT NULL REFERENCES public.listing_variants(id) ON DELETE CASCADE,
  attribute_value_id uuid NOT NULL REFERENCES public.listing_attribute_values(id) ON DELETE CASCADE,
  PRIMARY KEY (variant_id, attribute_value_id)
);

ALTER TABLE public.listing_attributes
  DROP CONSTRAINT IF EXISTS listing_attributes_type_check;

ALTER TABLE public.listing_attributes
  ADD CONSTRAINT listing_attributes_type_check
  CHECK (type IN ('select', 'text', 'number'));

ALTER TABLE public.listing_variants
  DROP CONSTRAINT IF EXISTS listing_variants_quantity_check;

ALTER TABLE public.listing_variants
  ADD CONSTRAINT listing_variants_quantity_check
  CHECK (quantity >= 0);

ALTER TABLE public.listing_variants
  DROP CONSTRAINT IF EXISTS listing_variants_price_check;

ALTER TABLE public.listing_variants
  ADD CONSTRAINT listing_variants_price_check
  CHECK (price IS NULL OR price >= 0);

CREATE INDEX IF NOT EXISTS listing_attributes_listing_id_idx
  ON public.listing_attributes (listing_id);

CREATE INDEX IF NOT EXISTS listing_attribute_values_attribute_id_idx
  ON public.listing_attribute_values (attribute_id);

CREATE INDEX IF NOT EXISTS listing_variants_listing_id_idx
  ON public.listing_variants (listing_id);

CREATE INDEX IF NOT EXISTS listing_variants_listing_id_is_active_idx
  ON public.listing_variants (listing_id, is_active);

CREATE INDEX IF NOT EXISTS listing_variant_options_variant_id_idx
  ON public.listing_variant_options (variant_id);

CREATE INDEX IF NOT EXISTS listing_variant_options_attribute_value_id_idx
  ON public.listing_variant_options (attribute_value_id);

CREATE UNIQUE INDEX IF NOT EXISTS listing_attributes_listing_name_unique_idx
  ON public.listing_attributes (listing_id, lower(btrim(name)));

CREATE UNIQUE INDEX IF NOT EXISTS listing_attribute_values_attribute_value_unique_idx
  ON public.listing_attribute_values (attribute_id, lower(btrim(value)));

ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL,
  ADD COLUMN IF NOT EXISTS variant_label text NULL,
  ADD COLUMN IF NOT EXISTS selected_options jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS variant_id uuid NULL,
  ADD COLUMN IF NOT EXISTS variant_label text NULL,
  ADD COLUMN IF NOT EXISTS selected_options jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'cart_items_variant_id_fkey'
      AND conrelid = 'public.cart_items'::regclass
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.listing_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_variant_id_fkey'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_variant_id_fkey
      FOREIGN KEY (variant_id) REFERENCES public.listing_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_listing_without_variant_unique_idx
  ON public.cart_items (cart_id, listing_id)
  WHERE variant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cart_items_cart_listing_variant_unique_idx
  ON public.cart_items (cart_id, listing_id, variant_id)
  WHERE variant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS cart_items_variant_id_idx
  ON public.cart_items (variant_id);

CREATE INDEX IF NOT EXISTS order_items_variant_id_idx
  ON public.order_items (variant_id);

ALTER TABLE public.cart_items
  DROP CONSTRAINT IF EXISTS cart_items_cart_listing_key;

CREATE OR REPLACE FUNCTION public.validate_listing_variant_option_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  variant_listing_id uuid;
  attribute_listing_id uuid;
BEGIN
  SELECT listing_id
  INTO variant_listing_id
  FROM public.listing_variants
  WHERE id = NEW.variant_id;

  SELECT la.listing_id
  INTO attribute_listing_id
  FROM public.listing_attribute_values lav
  JOIN public.listing_attributes la
    ON la.id = lav.attribute_id
  WHERE lav.id = NEW.attribute_value_id;

  IF variant_listing_id IS NULL OR attribute_listing_id IS NULL THEN
    RAISE EXCEPTION 'Variant options must reference existing listing data';
  END IF;

  IF variant_listing_id <> attribute_listing_id THEN
    RAISE EXCEPTION 'Variant option values must belong to the same listing';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listing_variant_options_validate_membership
  ON public.listing_variant_options;

CREATE TRIGGER listing_variant_options_validate_membership
BEFORE INSERT OR UPDATE ON public.listing_variant_options
FOR EACH ROW
EXECUTE FUNCTION public.validate_listing_variant_option_membership();

DROP TRIGGER IF EXISTS listing_attributes_set_updated_at
  ON public.listing_attributes;

CREATE TRIGGER listing_attributes_set_updated_at
BEFORE UPDATE ON public.listing_attributes
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

DROP TRIGGER IF EXISTS listing_variants_set_updated_at
  ON public.listing_variants;

CREATE TRIGGER listing_variants_set_updated_at
BEFORE UPDATE ON public.listing_variants
FOR EACH ROW
EXECUTE FUNCTION public.set_row_updated_at();

CREATE OR REPLACE FUNCTION public.can_read_listing_variant_source(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p_listing_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR public.has_admin_role('admin_readonly')
      OR EXISTS (
        SELECT 1
        FROM public.listings l
        WHERE l.id = p_listing_id
          AND l.business_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.public_listings_v pl
        WHERE pl.id = p_listing_id
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_listing_variant_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_listing_variant_source(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_listing_variant_source(p_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p_listing_id IS NOT NULL
    AND (
      auth.role() = 'service_role'
      OR public.has_admin_role('admin_ops')
      OR EXISTS (
        SELECT 1
        FROM public.listings l
        WHERE l.id = p_listing_id
          AND l.business_id = auth.uid()
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_listing_variant_source(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_listing_variant_source(uuid) TO authenticated;

ALTER TABLE public.listing_attributes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_variant_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Listing variant readers can read attributes" ON public.listing_attributes;
CREATE POLICY "Listing variant readers can read attributes"
  ON public.listing_attributes
  FOR SELECT
  TO anon, authenticated
  USING (public.can_read_listing_variant_source(listing_attributes.listing_id));

DROP POLICY IF EXISTS "Listing owners can manage attributes" ON public.listing_attributes;
CREATE POLICY "Listing owners can manage attributes"
  ON public.listing_attributes
  FOR ALL
  TO authenticated
  USING (public.can_manage_listing_variant_source(listing_attributes.listing_id))
  WITH CHECK (public.can_manage_listing_variant_source(listing_attributes.listing_id));

DROP POLICY IF EXISTS "Listing variant readers can read attribute values" ON public.listing_attribute_values;
CREATE POLICY "Listing variant readers can read attribute values"
  ON public.listing_attribute_values
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listing_attributes la
      WHERE la.id = listing_attribute_values.attribute_id
        AND public.can_read_listing_variant_source(la.listing_id)
    )
  );

DROP POLICY IF EXISTS "Listing owners can manage attribute values" ON public.listing_attribute_values;
CREATE POLICY "Listing owners can manage attribute values"
  ON public.listing_attribute_values
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listing_attributes la
      WHERE la.id = listing_attribute_values.attribute_id
        AND public.can_manage_listing_variant_source(la.listing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.listing_attributes la
      WHERE la.id = listing_attribute_values.attribute_id
        AND public.can_manage_listing_variant_source(la.listing_id)
    )
  );

DROP POLICY IF EXISTS "Listing variant readers can read variants" ON public.listing_variants;
CREATE POLICY "Listing variant readers can read variants"
  ON public.listing_variants
  FOR SELECT
  TO anon, authenticated
  USING (public.can_read_listing_variant_source(listing_variants.listing_id));

DROP POLICY IF EXISTS "Listing owners can manage variants" ON public.listing_variants;
CREATE POLICY "Listing owners can manage variants"
  ON public.listing_variants
  FOR ALL
  TO authenticated
  USING (public.can_manage_listing_variant_source(listing_variants.listing_id))
  WITH CHECK (public.can_manage_listing_variant_source(listing_variants.listing_id));

DROP POLICY IF EXISTS "Listing variant readers can read variant options" ON public.listing_variant_options;
CREATE POLICY "Listing variant readers can read variant options"
  ON public.listing_variant_options
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listing_variants lv
      WHERE lv.id = listing_variant_options.variant_id
        AND public.can_read_listing_variant_source(lv.listing_id)
    )
  );

DROP POLICY IF EXISTS "Listing owners can manage variant options" ON public.listing_variant_options;
CREATE POLICY "Listing owners can manage variant options"
  ON public.listing_variant_options
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.listing_variants lv
      WHERE lv.id = listing_variant_options.variant_id
        AND public.can_manage_listing_variant_source(lv.listing_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.listing_variants lv
      WHERE lv.id = listing_variant_options.variant_id
        AND public.can_manage_listing_variant_source(lv.listing_id)
    )
  );

CREATE OR REPLACE FUNCTION public.replace_listing_option_tree(
  p_listing_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_listing record;
  v_has_options boolean := COALESCE((p_payload ->> 'hasOptions')::boolean, false);
  v_attribute jsonb;
  v_value jsonb;
  v_variant jsonb;
  v_attribute_id uuid;
  v_value_id uuid;
  v_variant_id uuid;
  v_attribute_name text;
  v_attribute_type text;
  v_attribute_name_key text;
  v_value_text text;
  v_value_key text;
  v_attributes_seen text[] := ARRAY[]::text[];
  v_values_seen text[];
  v_attribute_map jsonb := '{}'::jsonb;
  v_value_map jsonb := '{}'::jsonb;
  v_variant_options jsonb;
  v_option record;
BEGIN
  IF p_listing_id IS NULL THEN
    RAISE EXCEPTION 'listing id is required';
  END IF;

  SELECT l.*
  INTO v_listing
  FROM public.listings l
  WHERE l.id = p_listing_id;

  IF v_listing.id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  -- Intentionally SECURITY INVOKER. This function should follow caller privileges
  -- and table RLS, then apply this explicit ownership/admin gate before mutation.
  IF NOT public.can_manage_listing_variant_source(p_listing_id) THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  DELETE FROM public.listing_variants
  WHERE listing_id = p_listing_id;

  DELETE FROM public.listing_attributes
  WHERE listing_id = p_listing_id;

  IF NOT v_has_options THEN
    RETURN jsonb_build_object(
      'listing_id', p_listing_id,
      'has_options', false,
      'attribute_count', 0,
      'variant_count', 0
    );
  END IF;

  IF jsonb_typeof(COALESCE(p_payload -> 'attributes', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_payload -> 'attributes', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one attribute is required when product options are enabled';
  END IF;

  IF jsonb_typeof(COALESCE(p_payload -> 'variants', '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_payload -> 'variants', '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'At least one variant is required when product options are enabled';
  END IF;

  FOR v_attribute IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_payload -> 'attributes', '[]'::jsonb))
  LOOP
    v_attribute_name := regexp_replace(btrim(COALESCE(v_attribute ->> 'name', '')), '\s+', ' ', 'g');
    v_attribute_type := lower(btrim(COALESCE(v_attribute ->> 'type', 'select')));
    v_attribute_name_key := lower(v_attribute_name);
    v_values_seen := ARRAY[]::text[];

    IF v_attribute_name = '' THEN
      RAISE EXCEPTION 'Attribute name is required';
    END IF;

    IF v_attribute_name_key = ANY(v_attributes_seen) THEN
      RAISE EXCEPTION 'Duplicate attribute names are not allowed';
    END IF;

    v_attributes_seen := array_append(v_attributes_seen, v_attribute_name_key);

    IF v_attribute_type <> 'select' THEN
      RAISE EXCEPTION 'Phase 1 supports select option types only';
    END IF;

    INSERT INTO public.listing_attributes (
      listing_id,
      name,
      type,
      required,
      sort_order
    )
    VALUES (
      p_listing_id,
      v_attribute_name,
      v_attribute_type,
      COALESCE((v_attribute ->> 'required')::boolean, false),
      COALESCE((v_attribute ->> 'sort_order')::integer, 0)
    )
    RETURNING id INTO v_attribute_id;

    v_attribute_map := jsonb_set(
      v_attribute_map,
      ARRAY[v_attribute_name_key],
      to_jsonb(v_attribute_id),
      true
    );

    IF jsonb_typeof(COALESCE(v_attribute -> 'values', '[]'::jsonb)) <> 'array'
      OR jsonb_array_length(COALESCE(v_attribute -> 'values', '[]'::jsonb)) = 0 THEN
      RAISE EXCEPTION 'Each attribute must include at least one value';
    END IF;

    FOR v_value IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_attribute -> 'values', '[]'::jsonb))
    LOOP
      v_value_text := regexp_replace(btrim(COALESCE(v_value ->> 'value', '')), '\s+', ' ', 'g');
      v_value_key := lower(v_value_text);

      IF v_value_text = '' THEN
        RAISE EXCEPTION 'Attribute values are required';
      END IF;

      IF v_value_key = ANY(v_values_seen) THEN
        RAISE EXCEPTION 'Duplicate values are not allowed inside a single attribute';
      END IF;

      v_values_seen := array_append(v_values_seen, v_value_key);

      INSERT INTO public.listing_attribute_values (
        attribute_id,
        value,
        sort_order
      )
      VALUES (
        v_attribute_id,
        v_value_text,
        COALESCE((v_value ->> 'sort_order')::integer, 0)
      )
      RETURNING id INTO v_value_id;

      v_value_map := jsonb_set(
        v_value_map,
        ARRAY[v_attribute_name_key, v_value_key],
        to_jsonb(v_value_id),
        true
      );
    END LOOP;
  END LOOP;

  FOR v_variant IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(p_payload -> 'variants', '[]'::jsonb))
  LOOP
    INSERT INTO public.listing_variants (
      listing_id,
      sku,
      price,
      quantity,
      is_active,
      sort_order
    )
    VALUES (
      p_listing_id,
      NULLIF(btrim(COALESCE(v_variant ->> 'sku', '')), ''),
      CASE
        WHEN v_variant ? 'price' AND NULLIF(v_variant ->> 'price', '') IS NOT NULL
          THEN round((v_variant ->> 'price')::numeric, 2)
        ELSE NULL
      END,
      GREATEST(COALESCE((v_variant ->> 'quantity')::integer, 0), 0),
      COALESCE((v_variant ->> 'is_active')::boolean, true),
      COALESCE((v_variant ->> 'sort_order')::integer, 0)
    )
    RETURNING id INTO v_variant_id;

    v_variant_options := COALESCE(v_variant -> 'options', '{}'::jsonb);
    IF jsonb_typeof(v_variant_options) <> 'object' THEN
      RAISE EXCEPTION 'Variant options must be an object';
    END IF;

    FOR v_option IN
      SELECT key, value
      FROM jsonb_each_text(v_variant_options)
    LOOP
      v_attribute_name_key := lower(regexp_replace(btrim(COALESCE(v_option.key, '')), '\s+', ' ', 'g'));
      v_value_key := lower(regexp_replace(btrim(COALESCE(v_option.value, '')), '\s+', ' ', 'g'));

      IF NOT (v_attribute_map ? v_attribute_name_key) THEN
        RAISE EXCEPTION 'Variant option attribute % does not exist on this listing', v_option.key;
      END IF;

      IF COALESCE(v_value_map #>> ARRAY[v_attribute_name_key, v_value_key], '') = '' THEN
        RAISE EXCEPTION 'Variant option value % does not exist for attribute %', v_option.value, v_option.key;
      END IF;

      INSERT INTO public.listing_variant_options (
        variant_id,
        attribute_value_id
      )
      VALUES (
        v_variant_id,
        (v_value_map #>> ARRAY[v_attribute_name_key, v_value_key])::uuid
      );
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'listing_id', p_listing_id,
    'has_options', true,
    'attribute_count', jsonb_array_length(COALESCE(p_payload -> 'attributes', '[]'::jsonb)),
    'variant_count', jsonb_array_length(COALESCE(p_payload -> 'variants', '[]'::jsonb))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_listing_option_tree(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_listing_option_tree(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION public.replace_listing_option_tree(uuid, jsonb) IS
  'Invoker-scoped listing option replacement. Relies on explicit can_manage_listing_variant_source() checks and table RLS rather than SECURITY DEFINER bypass.';

NOTIFY pgrst, 'reload schema';
