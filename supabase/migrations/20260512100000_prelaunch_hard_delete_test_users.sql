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

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS allow_hard_delete boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public._admin_hd_table_exists(p_table text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT to_regclass('public.' || p_table) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_column_exists(p_table text, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  );
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_count(p_table text, p_where text)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public._admin_hd_table_exists(p_table) THEN
    RETURN 0;
  END IF;

  EXECUTE format('SELECT count(*)::integer FROM public.%I WHERE %s', p_table, p_where)
    INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_delete(p_table text, p_where text)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public._admin_hd_table_exists(p_table) THEN
    RETURN 0;
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE %s', p_table, p_where);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN COALESCE(v_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_table_has_columns(p_table text, p_columns text[])
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public._admin_hd_table_exists(p_table)
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_columns, ARRAY[]::text[])) AS required_column(column_name)
      WHERE NOT public._admin_hd_column_exists(p_table, required_column.column_name)
    );
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_count_if_columns(
  p_table text,
  p_required_columns text[],
  p_where text
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_hd_table_has_columns(p_table, p_required_columns) THEN
    RETURN 0;
  END IF;

  RETURN public._admin_hd_count(p_table, p_where);
END;
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_delete_if_columns(
  p_table text,
  p_required_columns text[],
  p_where text
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_hd_table_has_columns(p_table, p_required_columns) THEN
    RETURN 0;
  END IF;

  RETURN public._admin_hd_delete(p_table, p_where);
END;
$$;

CREATE OR REPLACE FUNCTION public._admin_hd_jsonb_set_count(
  p_counts jsonb,
  p_key text,
  p_value integer
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_set(COALESCE(p_counts, '{}'::jsonb), ARRAY[p_key], to_jsonb(COALESCE(p_value, 0)), true);
$$;

CREATE OR REPLACE FUNCTION public.admin_preview_hard_delete_test_user(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user jsonb;
  v_email text;
  v_eligible boolean := false;
  v_block_reason text := NULL;
  v_counts jsonb := '{}'::jsonb;
  v_storage_objects jsonb := '[]'::jsonb;
  v_business_ids text;
  v_listing_ids text;
  v_order_ids text;
  v_unpaid_order_predicate text;
  v_listing_predicate text;
  v_vendor_member_predicate text;
  v_media_owner_predicate text;
  v_media_path_values text;
  v_moderation_predicate text;
  v_real_business_predicate text;
  v_business_safe_predicate text := '';
  v_business_marker_count integer := 0;
  v_owned_business_count integer := 0;
  v_real_business_count integer := 0;
  v_real_member_count integer := 0;
  v_real_commerce_count integer := 0;
  v_shared_conversation_count integer := 0;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'p_target_user_id is required';
  END IF;

  SELECT to_jsonb(u), lower(COALESCE(u.email, ''))
  INTO v_user, v_email
  FROM public.users u
  WHERE u.id = p_target_user_id;

  IF v_user IS NULL THEN
    RETURN jsonb_build_object(
      'eligible', false,
      'blocked', true,
      'block_reason', 'Target user not found.',
      'counts', '{}'::jsonb,
      'storage_objects', '[]'::jsonb,
      'warnings', jsonb_build_array()
    );
  END IF;

  v_eligible :=
    COALESCE((v_user ->> 'allow_hard_delete')::boolean, false)
    OR COALESCE((v_user ->> 'is_internal')::boolean, false)
    OR COALESCE((v_user ->> 'is_test')::boolean, false)
    OR COALESCE((v_user ->> 'is_seeded')::boolean, false);

  IF NOT v_eligible THEN
    v_block_reason := 'This user is not marked as fake, test, or internal. Use the normal account deletion/anonymization flow instead.';
  END IF;

  SELECT COALESCE(string_agg(quote_literal(id::text), ','), quote_literal('00000000-0000-0000-0000-000000000000'))
  INTO v_business_ids
  FROM public.businesses
  WHERE owner_user_id = p_target_user_id;

  -- In the current schema, listings.business_id stores the business owner user id.
  -- Public listing views join businesses with: businesses.owner_user_id = listings.business_id.
  v_listing_predicate := format('business_id = %L::uuid', p_target_user_id);

  SELECT COALESCE(string_agg(quote_literal(id::text), ','), quote_literal('00000000-0000-0000-0000-000000000000'))
  INTO v_listing_ids
  FROM public.listings
  WHERE business_id = p_target_user_id;

  IF public._admin_hd_table_has_columns('businesses', ARRAY['owner_user_id']) THEN
    v_owned_business_count := public._admin_hd_count_if_columns(
      'businesses',
      ARRAY['owner_user_id'],
      format('owner_user_id = %L::uuid', p_target_user_id)
    );

    IF public._admin_hd_column_exists('businesses', 'is_internal') THEN
      v_business_safe_predicate := 'COALESCE(is_internal, false) = true';
      v_business_marker_count := v_business_marker_count + 1;
    END IF;
    IF public._admin_hd_column_exists('businesses', 'is_test') THEN
      IF v_business_safe_predicate <> '' THEN
        v_business_safe_predicate := v_business_safe_predicate || ' OR ';
      END IF;
      v_business_safe_predicate := v_business_safe_predicate || 'COALESCE(is_test, false) = true';
      v_business_marker_count := v_business_marker_count + 1;
    END IF;
    IF public._admin_hd_column_exists('businesses', 'is_seeded') THEN
      IF v_business_safe_predicate <> '' THEN
        v_business_safe_predicate := v_business_safe_predicate || ' OR ';
      END IF;
      v_business_safe_predicate := v_business_safe_predicate || 'COALESCE(is_seeded, false) = true';
      v_business_marker_count := v_business_marker_count + 1;
    END IF;
    IF public._admin_hd_column_exists('businesses', 'allow_hard_delete') THEN
      IF v_business_safe_predicate <> '' THEN
        v_business_safe_predicate := v_business_safe_predicate || ' OR ';
      END IF;
      v_business_safe_predicate := v_business_safe_predicate || 'COALESCE(allow_hard_delete, false) = true';
      v_business_marker_count := v_business_marker_count + 1;
    END IF;

    IF v_owned_business_count > 0 AND v_business_marker_count = 0 THEN
      v_real_business_count := v_owned_business_count;
    ELSIF v_owned_business_count > 0 THEN
      v_real_business_predicate := format(
        'owner_user_id = %L::uuid AND NOT (%s)',
        p_target_user_id,
        v_business_safe_predicate
      );
      v_real_business_count := public._admin_hd_count_if_columns(
        'businesses',
        ARRAY['owner_user_id'],
        v_real_business_predicate
      );
    END IF;
  END IF;

  IF v_real_business_count > 0 THEN
    v_block_reason := 'A business owned by this user is not marked as fake, test, internal, seeded, or hard-deletable.';
  END IF;

  v_vendor_member_predicate := format('vm.vendor_id = %L::uuid', p_target_user_id);
  IF public._admin_hd_column_exists('vendor_members', 'business_entity_id') THEN
    v_vendor_member_predicate := v_vendor_member_predicate || format(' OR vm.business_entity_id::text IN (%s)', v_business_ids);
  END IF;

  IF public._admin_hd_table_has_columns('vendor_members', ARRAY['user_id', 'vendor_id']) THEN
    EXECUTE format(
      'SELECT count(*)::integer
       FROM public.vendor_members vm
       JOIN public.users member_user ON member_user.id = vm.user_id
       WHERE (%s)
         AND vm.user_id <> %L::uuid
         AND COALESCE((to_jsonb(member_user) ->> ''allow_hard_delete'')::boolean, false) = false
         AND COALESCE((to_jsonb(member_user) ->> ''is_internal'')::boolean, false) = false
         AND COALESCE((to_jsonb(member_user) ->> ''is_test'')::boolean, false) = false
         AND COALESCE((to_jsonb(member_user) ->> ''is_seeded'')::boolean, false) = false',
      v_vendor_member_predicate,
      p_target_user_id
    )
    INTO v_real_member_count;
  END IF;

  IF v_real_member_count > 0 THEN
    v_block_reason := 'A business owned by this user has real vendor members and cannot be hard deleted.';
  END IF;

  IF public._admin_hd_table_has_columns('orders', ARRAY['user_id', 'vendor_id', 'status'])
     AND public._admin_hd_table_has_columns('order_items', ARRAY['order_id', 'listing_id']) THEN
    v_real_commerce_count := public._admin_hd_count(
      'orders',
      format(
        '(user_id = %L::uuid OR vendor_id = %L::uuid OR id IN (SELECT order_id FROM public.order_items WHERE listing_id::text IN (%s))) AND (status::text IN (''confirmed'', ''completed'', ''fulfilled'', ''ready'', ''out_for_delivery'')%s%s%s%s)',
        p_target_user_id,
        p_target_user_id,
        v_listing_ids,
        CASE WHEN public._admin_hd_column_exists('orders', 'paid_at') THEN ' OR paid_at IS NOT NULL' ELSE '' END,
        CASE WHEN public._admin_hd_column_exists('orders', 'stripe_checkout_session_id') THEN ' OR NULLIF(stripe_checkout_session_id, '''') IS NOT NULL' ELSE '' END,
        CASE WHEN public._admin_hd_column_exists('orders', 'stripe_payment_intent_id') THEN ' OR NULLIF(stripe_payment_intent_id, '''') IS NOT NULL' ELSE '' END,
        CASE WHEN public._admin_hd_column_exists('orders', 'stripe_charge_id') THEN ' OR NULLIF(stripe_charge_id, '''') IS NOT NULL' ELSE '' END
      )
    );
  END IF;

  IF v_real_commerce_count > 0 THEN
    v_block_reason := 'This user has real commerce records and cannot be hard deleted.';
  END IF;

  IF public._admin_hd_table_has_columns('conversations', ARRAY['customer_id', 'business_id']) THEN
    -- Current schema stores conversations.business_id as public.users.id.
    -- The EXISTS branch also supports environments where it was migrated to public.businesses.id.
    SELECT count(*)::integer
    INTO v_shared_conversation_count
    FROM public.conversations c
    WHERE (c.customer_id = p_target_user_id OR c.business_id = p_target_user_id OR c.business_id::text IN (SELECT id::text FROM public.businesses WHERE owner_user_id = p_target_user_id))
      AND (
        EXISTS (
          SELECT 1
          FROM public.users other_user
          WHERE other_user.id = CASE
              WHEN c.customer_id = p_target_user_id THEN c.business_id
              ELSE c.customer_id
            END
            AND COALESCE((to_jsonb(other_user) ->> 'allow_hard_delete')::boolean, false) = false
            AND COALESCE((to_jsonb(other_user) ->> 'is_internal')::boolean, false) = false
            AND COALESCE((to_jsonb(other_user) ->> 'is_test')::boolean, false) = false
            AND COALESCE((to_jsonb(other_user) ->> 'is_seeded')::boolean, false) = false
        )
        OR EXISTS (
          SELECT 1
          FROM public.businesses cb
          JOIN public.users owner_user ON owner_user.id = cb.owner_user_id
          WHERE c.customer_id = p_target_user_id
            AND cb.id = c.business_id
            AND COALESCE(cb.is_internal, false) = false
            AND COALESCE((to_jsonb(owner_user) ->> 'allow_hard_delete')::boolean, false) = false
            AND COALESCE((to_jsonb(owner_user) ->> 'is_internal')::boolean, false) = false
            AND COALESCE((to_jsonb(owner_user) ->> 'is_test')::boolean, false) = false
            AND COALESCE((to_jsonb(owner_user) ->> 'is_seeded')::boolean, false) = false
        )
      );
  END IF;

  IF v_shared_conversation_count > 0 THEN
    v_block_reason := 'This user has conversations with real users and cannot be hard deleted.';
  END IF;

  IF public._admin_hd_table_has_columns('orders', ARRAY['id', 'user_id', 'vendor_id', 'status'])
     AND public._admin_hd_table_has_columns('order_items', ARRAY['order_id', 'listing_id']) THEN
    v_unpaid_order_predicate := format(
      '(user_id = %L::uuid OR vendor_id = %L::uuid OR id IN (SELECT order_id FROM public.order_items WHERE listing_id::text IN (%s))) AND status::text IN (''requested'', ''cancelled'', ''payment_failed'', ''pending_payment'')%s%s%s%s',
      p_target_user_id,
      p_target_user_id,
      v_listing_ids,
      CASE WHEN public._admin_hd_column_exists('orders', 'paid_at') THEN ' AND paid_at IS NULL' ELSE '' END,
      CASE WHEN public._admin_hd_column_exists('orders', 'stripe_checkout_session_id') THEN ' AND NULLIF(stripe_checkout_session_id, '''') IS NULL' ELSE '' END,
      CASE WHEN public._admin_hd_column_exists('orders', 'stripe_payment_intent_id') THEN ' AND NULLIF(stripe_payment_intent_id, '''') IS NULL' ELSE '' END,
      CASE WHEN public._admin_hd_column_exists('orders', 'stripe_charge_id') THEN ' AND NULLIF(stripe_charge_id, '''') IS NULL' ELSE '' END
    );
    EXECUTE format('SELECT COALESCE(string_agg(quote_literal(id::text), '',''), quote_literal(''00000000-0000-0000-0000-000000000000'')) FROM public.orders WHERE %s', v_unpaid_order_predicate)
      INTO v_order_ids;
  ELSE
    v_order_ids := quote_literal('00000000-0000-0000-0000-000000000000');
  END IF;

  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'user_profile', 1);
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'auth_account', 1);
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'businesses', public._admin_hd_count_if_columns('businesses', ARRAY['owner_user_id'], format('owner_user_id = %L::uuid', p_target_user_id)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'listings', public._admin_hd_count_if_columns('listings', ARRAY['business_id'], v_listing_predicate));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'listing_variants', public._admin_hd_count_if_columns('listing_variants', ARRAY['listing_id'], format('listing_id::text IN (%s)', v_listing_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'listing_attributes', public._admin_hd_count_if_columns('listing_attributes', ARRAY['listing_id'], format('listing_id::text IN (%s)', v_listing_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'saved_listings', public._admin_hd_count_if_columns('saved_listings', ARRAY['user_id', 'listing_id'], format('user_id = %L::uuid OR listing_id::text IN (%s)', p_target_user_id, v_listing_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'saved_businesses', public._admin_hd_count_if_columns('saved_businesses', ARRAY['user_id', 'business_id'], format('user_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, p_target_user_id, v_business_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'carts', public._admin_hd_count_if_columns('carts', ARRAY['id', 'user_id', 'vendor_id'], format('user_id = %L::uuid OR vendor_id = %L::uuid', p_target_user_id, p_target_user_id)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'cart_items', public._admin_hd_count_if_columns('cart_items', ARRAY['cart_id', 'vendor_id', 'listing_id'], format('vendor_id = %L::uuid OR listing_id::text IN (%s) OR cart_id IN (SELECT id FROM public.carts WHERE user_id = %L::uuid OR vendor_id = %L::uuid)', p_target_user_id, v_listing_ids, p_target_user_id, p_target_user_id)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'orders', public._admin_hd_count_if_columns('orders', ARRAY['id', 'user_id', 'vendor_id', 'status'], COALESCE(v_unpaid_order_predicate, 'false')));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'order_items', public._admin_hd_count_if_columns('order_items', ARRAY['order_id', 'listing_id'], format('order_id::text IN (%s) OR listing_id::text IN (%s)', v_order_ids, v_listing_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'reservations', public._admin_hd_count_if_columns('inventory_reservations', ARRAY['listing_id', 'order_id'], format('listing_id::text IN (%s) OR order_id::text IN (%s)', v_listing_ids, v_order_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'conversations', public._admin_hd_count_if_columns('conversations', ARRAY['customer_id', 'business_id'], format('customer_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, p_target_user_id, v_business_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'messages', public._admin_hd_count_if_columns('messages', ARRAY['sender_id', 'recipient_id', 'conversation_id'], format('sender_id = %L::uuid OR recipient_id = %L::uuid OR conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s))', p_target_user_id, p_target_user_id, p_target_user_id, p_target_user_id, v_business_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'notifications', public._admin_hd_count_if_columns('notifications', ARRAY['recipient_user_id', 'vendor_id', 'order_id'], format('recipient_user_id = %L::uuid OR vendor_id = %L::uuid OR order_id::text IN (%s)', p_target_user_id, p_target_user_id, v_order_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'order_notifications', public._admin_hd_count_if_columns('order_notifications', ARRAY['owner_user_id', 'business_entity_id', 'order_id'], format('owner_user_id = %L::uuid OR business_entity_id::text IN (%s) OR order_id::text IN (%s)', p_target_user_id, v_business_ids, v_order_ids)));
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'vendor_members', public._admin_hd_count_if_columns('vendor_members', ARRAY['user_id', 'vendor_id'], format('user_id = %L::uuid OR vendor_id = %L::uuid', p_target_user_id, p_target_user_id)));
  v_moderation_predicate := format('created_by_user_id = %L::uuid OR target_user_id = %L::uuid OR target_business_id = %L::uuid', p_target_user_id, p_target_user_id, p_target_user_id);
  IF public._admin_hd_column_exists('moderation_flags', 'target_listing_id') THEN
    v_moderation_predicate := v_moderation_predicate || format(' OR target_listing_id::text IN (%s)', v_listing_ids);
  END IF;
  v_counts := public._admin_hd_jsonb_set_count(v_counts, 'moderation_flags', public._admin_hd_count_if_columns('moderation_flags', ARRAY['created_by_user_id', 'target_user_id', 'target_business_id'], v_moderation_predicate));

  IF public._admin_hd_table_exists('business_reviews') THEN
    v_counts := public._admin_hd_jsonb_set_count(v_counts, 'reviews', public._admin_hd_count_if_columns('business_reviews', ARRAY['customer_id', 'business_id'], format('customer_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, p_target_user_id, v_business_ids)));
  ELSE
    v_counts := public._admin_hd_jsonb_set_count(v_counts, 'reviews', 0);
  END IF;

  IF public._admin_hd_table_has_columns('media_assets', ARRAY['owner_user_id', 'bucket']) THEN
    SELECT string_agg(format('(ma.%I)', column_name), ',')
    INTO v_media_path_values
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'media_assets'
      AND column_name IN (
        'original_path',
        'source_path',
        'thumb_path',
        'card_path',
        'detail_path',
        'cover_mobile_path',
        'cover_desktop_path',
        'avatar_128_path',
        'avatar_256_path',
        'enhanced_path'
      );

    v_media_owner_predicate := format('ma.owner_user_id = %L::uuid', p_target_user_id);
    IF public._admin_hd_column_exists('media_assets', 'business_id') THEN
      v_media_owner_predicate := v_media_owner_predicate || format(' OR ma.business_id::text IN (%s)', v_business_ids);
    END IF;
    IF public._admin_hd_column_exists('media_assets', 'listing_id') THEN
      v_media_owner_predicate := v_media_owner_predicate || format(' OR ma.listing_id::text IN (%s)', v_listing_ids);
    END IF;

    IF v_media_path_values IS NULL THEN
      v_media_path_values := '(NULL::text)';
    END IF;

    EXECUTE format(
      'SELECT COALESCE(
         jsonb_agg(DISTINCT jsonb_build_object(''bucket'', bucket, ''path'', path_value)),
         ''[]''::jsonb
       )
       FROM (
         SELECT ma.bucket, path_value
         FROM public.media_assets ma
         CROSS JOIN LATERAL (VALUES %s) AS paths(path_value)
         WHERE paths.path_value IS NOT NULL
           AND btrim(paths.path_value) <> ''''
           AND (%s)
       ) storage_paths',
      v_media_path_values,
      v_media_owner_predicate
    )
    INTO v_storage_objects;

    v_counts := public._admin_hd_jsonb_set_count(v_counts, 'media_assets', public._admin_hd_count_if_columns('media_assets', ARRAY['owner_user_id'], format('owner_user_id = %L::uuid%s%s', p_target_user_id, CASE WHEN public._admin_hd_column_exists('media_assets', 'business_id') THEN format(' OR business_id::text IN (%s)', v_business_ids) ELSE '' END, CASE WHEN public._admin_hd_column_exists('media_assets', 'listing_id') THEN format(' OR listing_id::text IN (%s)', v_listing_ids) ELSE '' END)));
    v_counts := public._admin_hd_jsonb_set_count(v_counts, 'storage_files', jsonb_array_length(v_storage_objects));
  ELSE
    v_counts := public._admin_hd_jsonb_set_count(v_counts, 'media_assets', 0);
    v_counts := public._admin_hd_jsonb_set_count(v_counts, 'storage_files', 0);
  END IF;

  RETURN jsonb_build_object(
    'eligible', v_eligible,
    'blocked', v_block_reason IS NOT NULL,
    'block_reason', v_block_reason,
    'counts', v_counts,
    'storage_objects', v_storage_objects,
    'warnings', jsonb_build_array()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_hard_delete_test_user(
  p_target_user_id uuid,
  p_confirmation text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preview jsonb;
  v_counts jsonb;
  v_deleted_counts jsonb := '{}'::jsonb;
  v_storage_objects jsonb;
  v_business_ids text;
  v_listing_ids text;
  v_order_ids text;
  v_unpaid_order_predicate text;
  v_listing_predicate text;
  v_vendor_member_predicate text;
  v_media_owner_predicate text;
  v_moderation_predicate text;
  v_business_safe_predicate text := '';
  v_business_delete_predicate text;
  v_deleted integer;
BEGIN
  IF p_confirmation <> 'HARD DELETE USER' THEN
    RAISE EXCEPTION 'Exact confirmation text is required';
  END IF;

  v_preview := public.admin_preview_hard_delete_test_user(p_target_user_id);
  IF COALESCE((v_preview ->> 'blocked')::boolean, false) OR COALESCE((v_preview ->> 'eligible')::boolean, false) = false THEN
    RAISE EXCEPTION '%', COALESCE(v_preview ->> 'block_reason', 'Hard delete is blocked');
  END IF;

  v_counts := v_preview -> 'counts';
  v_storage_objects := v_preview -> 'storage_objects';

  SELECT COALESCE(string_agg(quote_literal(id::text), ','), quote_literal('00000000-0000-0000-0000-000000000000'))
  INTO v_business_ids
  FROM public.businesses
  WHERE owner_user_id = p_target_user_id;

  v_listing_predicate := format('business_id = %L::uuid', p_target_user_id);

  SELECT COALESCE(string_agg(quote_literal(id::text), ','), quote_literal('00000000-0000-0000-0000-000000000000'))
  INTO v_listing_ids
  FROM public.listings
  WHERE business_id = p_target_user_id;

  IF public._admin_hd_table_has_columns('orders', ARRAY['id', 'user_id', 'vendor_id', 'status'])
     AND public._admin_hd_table_has_columns('order_items', ARRAY['order_id', 'listing_id']) THEN
    v_unpaid_order_predicate := format(
      '(user_id = %L::uuid OR vendor_id = %L::uuid OR id IN (SELECT order_id FROM public.order_items WHERE listing_id::text IN (%s))) AND status::text IN (''requested'', ''cancelled'', ''payment_failed'', ''pending_payment'')%s%s%s%s',
      p_target_user_id,
      p_target_user_id,
      v_listing_ids,
      CASE WHEN public._admin_hd_column_exists('orders', 'paid_at') THEN ' AND paid_at IS NULL' ELSE '' END,
      CASE WHEN public._admin_hd_column_exists('orders', 'stripe_checkout_session_id') THEN ' AND NULLIF(stripe_checkout_session_id, '''') IS NULL' ELSE '' END,
      CASE WHEN public._admin_hd_column_exists('orders', 'stripe_payment_intent_id') THEN ' AND NULLIF(stripe_payment_intent_id, '''') IS NULL' ELSE '' END,
      CASE WHEN public._admin_hd_column_exists('orders', 'stripe_charge_id') THEN ' AND NULLIF(stripe_charge_id, '''') IS NULL' ELSE '' END
    );
    EXECUTE format('SELECT COALESCE(string_agg(quote_literal(id::text), '',''), quote_literal(''00000000-0000-0000-0000-000000000000'')) FROM public.orders WHERE %s', v_unpaid_order_predicate)
      INTO v_order_ids;
  ELSE
    v_order_ids := quote_literal('00000000-0000-0000-0000-000000000000');
  END IF;

  v_deleted := public._admin_hd_delete_if_columns('order_notifications', ARRAY['owner_user_id', 'business_entity_id', 'order_id'], format('owner_user_id = %L::uuid OR business_entity_id::text IN (%s) OR order_id::text IN (%s)', p_target_user_id, v_business_ids, v_order_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'order_notifications', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('notifications', ARRAY['recipient_user_id', 'vendor_id', 'order_id'], format('recipient_user_id = %L::uuid OR vendor_id = %L::uuid OR order_id::text IN (%s)', p_target_user_id, p_target_user_id, v_order_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'notifications', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('order_status_events', ARRAY['order_id', 'vendor_id'], format('order_id::text IN (%s) OR vendor_id = %L::uuid', v_order_ids, p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'order_status_events', v_deleted);

  IF public._admin_hd_table_has_columns('order_items', ARRAY['order_id', 'listing_id', 'inventory_reservation_id']) THEN
    EXECUTE format('UPDATE public.order_items SET inventory_reservation_id = NULL WHERE order_id::text IN (%s) OR listing_id::text IN (%s)', v_order_ids, v_listing_ids);
  END IF;

  v_deleted := public._admin_hd_delete_if_columns('inventory_reservations', ARRAY['listing_id', 'order_id'], format('listing_id::text IN (%s) OR order_id::text IN (%s)', v_listing_ids, v_order_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'reservations', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('order_items', ARRAY['order_id', 'listing_id'], format('order_id::text IN (%s) OR listing_id::text IN (%s)', v_order_ids, v_listing_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'order_items', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('orders', ARRAY['id', 'user_id', 'vendor_id', 'status'], COALESCE(v_unpaid_order_predicate, 'false'));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'orders', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('cart_items', ARRAY['cart_id', 'vendor_id', 'listing_id'], format('vendor_id = %L::uuid OR listing_id::text IN (%s) OR cart_id IN (SELECT id FROM public.carts WHERE user_id = %L::uuid OR vendor_id = %L::uuid)', p_target_user_id, v_listing_ids, p_target_user_id, p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'cart_items', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('carts', ARRAY['user_id', 'vendor_id'], format('user_id = %L::uuid OR vendor_id = %L::uuid', p_target_user_id, p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'carts', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('messages', ARRAY['sender_id', 'recipient_id', 'conversation_id'], format('sender_id = %L::uuid OR recipient_id = %L::uuid OR conversation_id IN (SELECT id FROM public.conversations WHERE customer_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s))', p_target_user_id, p_target_user_id, p_target_user_id, p_target_user_id, v_business_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'messages', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('conversations', ARRAY['customer_id', 'business_id'], format('customer_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, p_target_user_id, v_business_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'conversations', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('saved_listings', ARRAY['user_id', 'listing_id'], format('user_id = %L::uuid OR listing_id::text IN (%s)', p_target_user_id, v_listing_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'saved_listings', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('saved_businesses', ARRAY['user_id', 'business_id'], format('user_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, p_target_user_id, v_business_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'saved_businesses', v_deleted);

  v_vendor_member_predicate := format('user_id = %L::uuid OR vendor_id = %L::uuid', p_target_user_id, p_target_user_id);
  IF public._admin_hd_column_exists('vendor_members', 'business_entity_id') THEN
    v_vendor_member_predicate := v_vendor_member_predicate || format(' OR business_entity_id::text IN (%s)', v_business_ids);
  END IF;
  v_deleted := public._admin_hd_delete_if_columns('vendor_members', ARRAY['user_id', 'vendor_id'], v_vendor_member_predicate);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'vendor_members', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('ai_description_usage', ARRAY['user_id', 'business_id'], format('user_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, v_business_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'ai_description_usage', v_deleted);

  IF public._admin_hd_table_exists('business_reviews') THEN
    v_deleted := public._admin_hd_delete_if_columns('business_reviews', ARRAY['customer_id', 'business_id'], format('customer_id = %L::uuid OR business_id = %L::uuid OR business_id::text IN (%s)', p_target_user_id, p_target_user_id, v_business_ids));
    v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'reviews', v_deleted);
  END IF;

  v_moderation_predicate := format('created_by_user_id = %L::uuid OR target_user_id = %L::uuid OR target_business_id = %L::uuid', p_target_user_id, p_target_user_id, p_target_user_id);
  IF public._admin_hd_column_exists('moderation_flags', 'target_listing_id') THEN
    v_moderation_predicate := v_moderation_predicate || format(' OR target_listing_id::text IN (%s)', v_listing_ids);
  END IF;
  v_deleted := public._admin_hd_delete_if_columns('moderation_flags', ARRAY['created_by_user_id', 'target_user_id', 'target_business_id'], v_moderation_predicate);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'moderation_flags', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('admin_user_notes', ARRAY['target_user_id'], format('target_user_id = %L::uuid', p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'admin_user_notes', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('admin_impersonation_sessions', ARRAY['target_user_id'], format('target_user_id = %L::uuid', p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'admin_impersonation_sessions', v_deleted);

  v_media_owner_predicate := format('owner_user_id = %L::uuid', p_target_user_id);
  IF public._admin_hd_column_exists('media_assets', 'business_id') THEN
    v_media_owner_predicate := v_media_owner_predicate || format(' OR business_id::text IN (%s)', v_business_ids);
  END IF;
  IF public._admin_hd_column_exists('media_assets', 'listing_id') THEN
    v_media_owner_predicate := v_media_owner_predicate || format(' OR listing_id::text IN (%s)', v_listing_ids);
  END IF;
  v_deleted := public._admin_hd_delete_if_columns('media_assets', ARRAY['owner_user_id'], v_media_owner_predicate);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'media_assets', v_deleted);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'storage_files', jsonb_array_length(COALESCE(v_storage_objects, '[]'::jsonb)));

  v_deleted := public._admin_hd_delete_if_columns('listing_variant_options', ARRAY['variant_id', 'attribute_value_id'], format('variant_id IN (SELECT id FROM public.listing_variants WHERE listing_id::text IN (%s)) OR attribute_value_id IN (SELECT lav.id FROM public.listing_attribute_values lav JOIN public.listing_attributes la ON la.id = lav.attribute_id WHERE la.listing_id::text IN (%s))', v_listing_ids, v_listing_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'listing_variant_options', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('listing_attribute_values', ARRAY['attribute_id'], format('attribute_id IN (SELECT id FROM public.listing_attributes WHERE listing_id::text IN (%s))', v_listing_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'listing_attribute_values', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('listing_attributes', ARRAY['listing_id'], format('listing_id::text IN (%s)', v_listing_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'listing_attributes', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('listing_variants', ARRAY['listing_id'], format('listing_id::text IN (%s)', v_listing_ids));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'listing_variants', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('listings', ARRAY['business_id'], v_listing_predicate);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'listings', v_deleted);

  v_business_delete_predicate := format('owner_user_id = %L::uuid AND false', p_target_user_id);
  IF public._admin_hd_table_has_columns('businesses', ARRAY['owner_user_id']) THEN
    IF public._admin_hd_column_exists('businesses', 'is_internal') THEN
      v_business_safe_predicate := 'COALESCE(is_internal, false) = true';
    END IF;
    IF public._admin_hd_column_exists('businesses', 'is_test') THEN
      IF v_business_safe_predicate <> '' THEN
        v_business_safe_predicate := v_business_safe_predicate || ' OR ';
      END IF;
      v_business_safe_predicate := v_business_safe_predicate || 'COALESCE(is_test, false) = true';
    END IF;
    IF public._admin_hd_column_exists('businesses', 'is_seeded') THEN
      IF v_business_safe_predicate <> '' THEN
        v_business_safe_predicate := v_business_safe_predicate || ' OR ';
      END IF;
      v_business_safe_predicate := v_business_safe_predicate || 'COALESCE(is_seeded, false) = true';
    END IF;
    IF public._admin_hd_column_exists('businesses', 'allow_hard_delete') THEN
      IF v_business_safe_predicate <> '' THEN
        v_business_safe_predicate := v_business_safe_predicate || ' OR ';
      END IF;
      v_business_safe_predicate := v_business_safe_predicate || 'COALESCE(allow_hard_delete, false) = true';
    END IF;

    IF v_business_safe_predicate <> '' THEN
      v_business_delete_predicate := format(
        'owner_user_id = %L::uuid AND (%s)',
        p_target_user_id,
        v_business_safe_predicate
      );
    END IF;
  END IF;

  v_deleted := public._admin_hd_delete_if_columns('businesses', ARRAY['owner_user_id'], v_business_delete_predicate);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'businesses', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('admin_role_members', ARRAY['user_id'], format('user_id = %L::uuid', p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'admin_role_members', v_deleted);

  v_deleted := public._admin_hd_delete_if_columns('users', ARRAY['id'], format('id = %L::uuid', p_target_user_id));
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'user_profile', v_deleted);
  v_deleted_counts := public._admin_hd_jsonb_set_count(v_deleted_counts, 'auth_account', 1);

  RETURN jsonb_build_object(
    'eligible', true,
    'blocked', false,
    'block_reason', NULL,
    'counts', v_deleted_counts,
    'preview_counts', v_counts,
    'deleted_counts', v_deleted_counts,
    'storage_objects', v_storage_objects,
    'warnings', jsonb_build_array()
  );
END;
$$;

REVOKE ALL ON FUNCTION public._admin_hd_table_exists(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_column_exists(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_count(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_delete(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_table_has_columns(text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_count_if_columns(text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_delete_if_columns(text, text[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._admin_hd_jsonb_set_count(jsonb, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_preview_hard_delete_test_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_hard_delete_test_user(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_preview_hard_delete_test_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_hard_delete_test_user(uuid, text) TO service_role;
