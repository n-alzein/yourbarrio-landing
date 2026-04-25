-- replace_listing_option_tree regression check
-- Creates disposable rows inside one transaction, calls the RPC with a
-- normal Size/Color payload, verifies row counts, then rolls everything back.
--
-- This script intentionally reuses one existing business owner identity from
-- production/staging instead of inventing a new public.users row. In the live
-- schema, public.users.id and public.businesses.owner_user_id both depend on
-- auth.users, so a rollback-only harness cannot create a valid disposable owner
-- without also mutating auth.*.

BEGIN;

CREATE TEMP TABLE listing_variant_rpc_regression_context AS
SELECT
  b.owner_user_id AS actor_user_id,
  b.id AS business_id,
  gen_random_uuid() AS listing_id
FROM public.businesses b
JOIN public.users u
  ON u.id = b.owner_user_id
WHERE COALESCE(b.is_internal, false) = false
ORDER BY
  CASE
    WHEN b.verification_status IN ('auto_verified', 'manually_verified') THEN 0
    ELSE 1
  END,
  b.created_at ASC
LIMIT 1;

GRANT SELECT ON TABLE listing_variant_rpc_regression_context TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM listing_variant_rpc_regression_context
  ) THEN
    RAISE EXCEPTION 'No eligible business owner was found for the RPC regression test';
  END IF;
END $$;

INSERT INTO public.listings (
  id,
  business_id,
  title,
  description,
  price,
  category,
  city,
  inventory_quantity,
  inventory_status,
  is_internal
)
SELECT
  c.listing_id,
  c.actor_user_id,
  'RPC regression listing',
  'Disposable listing for replace_listing_option_tree regression',
  19.99,
  'Gifts',
  'Long Beach',
  12,
  'in_stock',
  false
FROM listing_variant_rpc_regression_context c;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT set_config(
  'request.jwt.claim.sub',
  (SELECT actor_user_id::text FROM listing_variant_rpc_regression_context),
  true
);

SELECT public.replace_listing_option_tree(
  (SELECT listing_id FROM listing_variant_rpc_regression_context),
  jsonb_build_object(
    'hasOptions', true,
    'attributes', jsonb_build_array(
      jsonb_build_object(
        'name', 'Size',
        'type', 'select',
        'required', true,
        'values', jsonb_build_array(
          jsonb_build_object('value', 'Small'),
          jsonb_build_object('value', 'Medium')
        )
      ),
      jsonb_build_object(
        'name', 'Color',
        'type', 'select',
        'required', true,
        'values', jsonb_build_array(
          jsonb_build_object('value', 'Black'),
          jsonb_build_object('value', 'White')
        )
      )
    ),
    'variants', jsonb_build_array(
      jsonb_build_object(
        'sku', 'RPC-SM-BLK',
        'price', 20.99,
        'quantity', 3,
        'options', jsonb_build_object('Size', 'Small', 'Color', 'Black')
      ),
      jsonb_build_object(
        'sku', 'RPC-SM-WHT',
        'price', 20.99,
        'quantity', 4,
        'options', jsonb_build_object('Size', 'Small', 'Color', 'White')
      ),
      jsonb_build_object(
        'sku', 'RPC-MD-BLK',
        'price', 21.99,
        'quantity', 5,
        'options', jsonb_build_object('Size', 'Medium', 'Color', 'Black')
      ),
      jsonb_build_object(
        'sku', 'RPC-MD-WHT',
        'price', 21.99,
        'quantity', 6,
        'options', jsonb_build_object('Size', 'Medium', 'Color', 'White')
      )
    )
  )
) AS rpc_result;

RESET ROLE;

DO $$
DECLARE
  v_listing_id uuid := (SELECT listing_id FROM listing_variant_rpc_regression_context);
  v_attribute_count integer;
  v_value_count integer;
  v_variant_count integer;
  v_variant_option_count integer;
  v_bad_variant_count integer;
BEGIN
  SELECT COUNT(*)
  INTO v_attribute_count
  FROM public.listing_attributes
  WHERE listing_id = v_listing_id;

  IF v_attribute_count <> 2 THEN
    RAISE EXCEPTION 'Expected 2 attributes, found %', v_attribute_count;
  END IF;

  SELECT COUNT(*)
  INTO v_value_count
  FROM public.listing_attribute_values lav
  JOIN public.listing_attributes la
    ON la.id = lav.attribute_id
  WHERE la.listing_id = v_listing_id;

  IF v_value_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 attribute values, found %', v_value_count;
  END IF;

  SELECT COUNT(*)
  INTO v_variant_count
  FROM public.listing_variants
  WHERE listing_id = v_listing_id;

  IF v_variant_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 variants, found %', v_variant_count;
  END IF;

  SELECT COUNT(*)
  INTO v_variant_option_count
  FROM public.listing_variant_options lvo
  JOIN public.listing_variants lv
    ON lv.id = lvo.variant_id
  WHERE lv.listing_id = v_listing_id;

  IF v_variant_option_count <> 8 THEN
    RAISE EXCEPTION 'Expected 8 variant-option links, found %', v_variant_option_count;
  END IF;

  SELECT COUNT(*)
  INTO v_bad_variant_count
  FROM (
    SELECT lv.id
    FROM public.listing_variants lv
    LEFT JOIN public.listing_variant_options lvo
      ON lvo.variant_id = lv.id
    WHERE lv.listing_id = v_listing_id
    GROUP BY lv.id
    HAVING COUNT(lvo.attribute_value_id) <> 2
  ) failing_variants;

  IF v_bad_variant_count <> 0 THEN
    RAISE EXCEPTION 'Expected every variant to have exactly 2 option links; failing variants=%', v_bad_variant_count;
  END IF;
END $$;

SELECT
  COUNT(*) FILTER (WHERE source = 'attributes') AS attribute_count,
  COUNT(*) FILTER (WHERE source = 'attribute_values') AS attribute_value_count,
  COUNT(*) FILTER (WHERE source = 'variants') AS variant_count,
  COUNT(*) FILTER (WHERE source = 'variant_options') AS variant_option_count
FROM (
  SELECT 'attributes' AS source
  FROM public.listing_attributes
  WHERE listing_id = (SELECT listing_id FROM listing_variant_rpc_regression_context)
  UNION ALL
  SELECT 'attribute_values' AS source
  FROM public.listing_attribute_values lav
  JOIN public.listing_attributes la
    ON la.id = lav.attribute_id
  WHERE la.listing_id = (SELECT listing_id FROM listing_variant_rpc_regression_context)
  UNION ALL
  SELECT 'variants' AS source
  FROM public.listing_variants
  WHERE listing_id = (SELECT listing_id FROM listing_variant_rpc_regression_context)
  UNION ALL
  SELECT 'variant_options' AS source
  FROM public.listing_variant_options lvo
  JOIN public.listing_variants lv
    ON lv.id = lvo.variant_id
  WHERE lv.listing_id = (SELECT listing_id FROM listing_variant_rpc_regression_context)
) counts;

ROLLBACK;
