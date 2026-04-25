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

CREATE OR REPLACE FUNCTION public.replace_listing_option_tree(
  p_listing_id uuid,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_listing record;
  v_has_options boolean := COALESCE((p_payload ->> 'hasOptions')::boolean, false);
  v_attribute jsonb;
  v_value jsonb;
  v_variant jsonb;
  v_option record;
  v_attribute_id uuid;
  v_value_id uuid;
  v_variant_id uuid;
  v_attribute_name text;
  v_attribute_type text;
  v_attribute_name_key text;
  v_value_text text;
  v_value_key text;
  v_variant_options jsonb;
  v_attributes_seen text[] := ARRAY[]::text[];
  v_values_seen text[];
  v_variant_attribute_keys text[];
  v_variant_option_link_count integer;
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
    v_variant_attribute_keys := ARRAY[]::text[];
    v_variant_option_link_count := 0;

    IF jsonb_typeof(v_variant_options) <> 'object' THEN
      RAISE EXCEPTION 'Variant options must be an object';
    END IF;

    FOR v_option IN
      SELECT key, value
      FROM jsonb_each_text(v_variant_options)
    LOOP
      v_attribute_name_key := lower(regexp_replace(btrim(COALESCE(v_option.key, '')), '\s+', ' ', 'g'));
      v_value_key := lower(regexp_replace(btrim(COALESCE(v_option.value, '')), '\s+', ' ', 'g'));

      IF v_attribute_name_key = '' THEN
        RAISE EXCEPTION 'Variant option attribute name is required';
      END IF;

      IF v_value_key = '' THEN
        RAISE EXCEPTION 'Variant option value is required for attribute %', v_option.key;
      END IF;

      IF v_attribute_name_key = ANY(v_variant_attribute_keys) THEN
        RAISE EXCEPTION 'Variant option attribute % is duplicated after normalization', v_option.key;
      END IF;

      v_variant_attribute_keys := array_append(v_variant_attribute_keys, v_attribute_name_key);

      SELECT lav.id
      INTO v_value_id
      FROM public.listing_attributes la
      JOIN public.listing_attribute_values lav
        ON lav.attribute_id = la.id
      WHERE la.listing_id = p_listing_id
        AND lower(regexp_replace(btrim(la.name), '\s+', ' ', 'g')) = v_attribute_name_key
        AND lower(regexp_replace(btrim(lav.value), '\s+', ' ', 'g')) = v_value_key
      LIMIT 1;

      IF v_value_id IS NULL THEN
        RAISE EXCEPTION 'Variant option value % does not exist for attribute %', v_option.value, v_option.key;
      END IF;

      INSERT INTO public.listing_variant_options (
        variant_id,
        attribute_value_id
      )
      VALUES (
        v_variant_id,
        v_value_id
      );

      v_variant_option_link_count := v_variant_option_link_count + 1;
    END LOOP;

    IF v_variant_option_link_count = 0 THEN
      RAISE EXCEPTION 'Each variant must include at least one option';
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'listing_id', p_listing_id,
    'has_options', true,
    'attribute_count', jsonb_array_length(COALESCE(p_payload -> 'attributes', '[]'::jsonb)),
    'variant_count', jsonb_array_length(COALESCE(p_payload -> 'variants', '[]'::jsonb))
  );
END;
$$;

COMMENT ON FUNCTION public.replace_listing_option_tree(uuid, jsonb) IS
  'Invoker-scoped listing option replacement. Uses direct normalized attribute/value lookups instead of jsonb key maps, and still relies on explicit can_manage_listing_variant_source() checks plus table RLS.';

NOTIFY pgrst, 'reload schema';
