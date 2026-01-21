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
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_type') THEN
    CREATE TYPE public.fulfillment_type AS ENUM ('delivery', 'pickup');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cart_status') THEN
    CREATE TYPE public.cart_status AS ENUM ('active', 'submitted', 'abandoned');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE public.order_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.carts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  status public.cart_status DEFAULT 'active' NOT NULL,
  fulfillment_type public.fulfillment_type,
  fulfillment_locked boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.carts OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  cart_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  listing_id uuid NOT NULL,
  quantity integer NOT NULL,
  title text NOT NULL,
  unit_price numeric(10,2),
  image_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.cart_items OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_number text NOT NULL,
  user_id uuid NOT NULL,
  vendor_id uuid NOT NULL,
  cart_id uuid,
  status public.order_status DEFAULT 'requested' NOT NULL,
  fulfillment_type public.fulfillment_type NOT NULL,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  delivery_address1 text,
  delivery_address2 text,
  delivery_city text,
  delivery_state text,
  delivery_postal_code text,
  delivery_instructions text,
  delivery_time text,
  pickup_time text,
  subtotal numeric(10,2) DEFAULT 0 NOT NULL,
  fees numeric(10,2) DEFAULT 0 NOT NULL,
  total numeric(10,2) DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.orders OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  order_id uuid NOT NULL,
  listing_id uuid,
  title text NOT NULL,
  unit_price numeric(10,2),
  image_url text,
  quantity integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.order_items OWNER TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_pkey'
  ) THEN
    ALTER TABLE public.carts ADD CONSTRAINT carts_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_pkey'
  ) THEN
    ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_pkey'
  ) THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_pkey'
  ) THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_user_id_fkey'
  ) THEN
    ALTER TABLE public.carts
      ADD CONSTRAINT carts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.carts
      ADD CONSTRAINT carts_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'carts_id_vendor_id_key'
  ) THEN
    ALTER TABLE public.carts
      ADD CONSTRAINT carts_id_vendor_id_key UNIQUE (id, vendor_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_vendor_fkey'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_cart_vendor_fkey
      FOREIGN KEY (cart_id, vendor_id)
      REFERENCES public.carts(id, vendor_id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_listing_id_fkey'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_quantity_check'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_quantity_check CHECK (quantity > 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cart_items_cart_listing_key'
  ) THEN
    ALTER TABLE public.cart_items
      ADD CONSTRAINT cart_items_cart_listing_key UNIQUE (cart_id, listing_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_number_key'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_user_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_cart_id_fkey'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_cart_id_fkey
      FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_order_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_items_listing_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_listing_id_fkey
      FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS carts_user_id_idx ON public.carts (user_id);
CREATE INDEX IF NOT EXISTS carts_vendor_id_idx ON public.carts (vendor_id);
CREATE INDEX IF NOT EXISTS carts_status_idx ON public.carts (status);
CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);
CREATE INDEX IF NOT EXISTS orders_vendor_id_idx ON public.orders (vendor_id);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own carts'
  ) THEN
    CREATE POLICY "Users manage own carts"
      ON public.carts FOR ALL
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users manage own cart items'
  ) THEN
    CREATE POLICY "Users manage own cart items"
      ON public.cart_items FOR ALL
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.carts
          WHERE carts.id = cart_items.cart_id
          AND carts.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.carts
          WHERE carts.id = cart_items.cart_id
          AND carts.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own orders'
  ) THEN
    CREATE POLICY "Users can read own orders"
      ON public.orders FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own orders'
  ) THEN
    CREATE POLICY "Users can create own orders"
      ON public.orders FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can read own order items'
  ) THEN
    CREATE POLICY "Users can read own order items"
      ON public.order_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert own order items'
  ) THEN
    CREATE POLICY "Users can insert own order items"
      ON public.order_items FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.orders
          WHERE orders.id = order_items.order_id
          AND orders.user_id = auth.uid()
        )
      );
  END IF;
END$$;
