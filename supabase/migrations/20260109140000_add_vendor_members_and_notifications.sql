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

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'out_for_delivery';
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'fulfilled';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

CREATE TABLE IF NOT EXISTS public.vendor_members (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  vendor_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text DEFAULT 'owner' NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.vendor_members OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  recipient_user_id uuid NOT NULL,
  vendor_id uuid,
  order_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications OWNER TO postgres;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_members_pkey'
  ) THEN
    ALTER TABLE public.vendor_members ADD CONSTRAINT vendor_members_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_pkey'
  ) THEN
    ALTER TABLE public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_members_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.vendor_members
      ADD CONSTRAINT vendor_members_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.vendor_members
      ADD CONSTRAINT vendor_members_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_members_vendor_user_key'
  ) THEN
    ALTER TABLE public.vendor_members
      ADD CONSTRAINT vendor_members_vendor_user_key UNIQUE (vendor_id, user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_recipient_user_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_recipient_user_id_fkey
      FOREIGN KEY (recipient_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_vendor_id_fkey
      FOREIGN KEY (vendor_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_order_id_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_order_id_fkey
      FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS vendor_members_vendor_id_idx ON public.vendor_members (vendor_id);
CREATE INDEX IF NOT EXISTS vendor_members_user_id_idx ON public.vendor_members (user_id);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON public.notifications (recipient_user_id);
CREATE INDEX IF NOT EXISTS notifications_vendor_idx ON public.notifications (vendor_id);
CREATE INDEX IF NOT EXISTS notifications_read_idx ON public.notifications (read_at);

ALTER TABLE public.vendor_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Members can read own vendor memberships'
  ) THEN
    CREATE POLICY "Members can read own vendor memberships"
      ON public.vendor_members FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Owners can self-assign vendor membership'
  ) THEN
    CREATE POLICY "Owners can self-assign vendor membership"
      ON public.vendor_members FOR INSERT
      TO authenticated
      WITH CHECK (
        auth.uid() = user_id
        AND auth.uid() = vendor_id
        AND EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid()
          AND users.role = 'business'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Vendors can read orders'
  ) THEN
    CREATE POLICY "Vendors can read orders"
      ON public.orders FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.vendor_members
          WHERE vendor_members.vendor_id = orders.vendor_id
          AND vendor_members.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Vendors can update orders'
  ) THEN
    CREATE POLICY "Vendors can update orders"
      ON public.orders FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.vendor_members
          WHERE vendor_members.vendor_id = orders.vendor_id
          AND vendor_members.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.vendor_members
          WHERE vendor_members.vendor_id = orders.vendor_id
          AND vendor_members.user_id = auth.uid()
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Vendors can read order items'
  ) THEN
    CREATE POLICY "Vendors can read order items"
      ON public.order_items FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.orders
          JOIN public.vendor_members
            ON vendor_members.vendor_id = orders.vendor_id
           AND vendor_members.user_id = auth.uid()
          WHERE orders.id = order_items.order_id
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipients can read notifications'
  ) THEN
    CREATE POLICY "Recipients can read notifications"
      ON public.notifications FOR SELECT
      TO authenticated
      USING (auth.uid() = recipient_user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipients can update notifications'
  ) THEN
    CREATE POLICY "Recipients can update notifications"
      ON public.notifications FOR UPDATE
      TO authenticated
      USING (auth.uid() = recipient_user_id)
      WITH CHECK (auth.uid() = recipient_user_id);
  END IF;
END$$;

CREATE OR REPLACE FUNCTION public.handle_order_requested_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'requested' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.vendor_members (vendor_id, user_id, role)
  SELECT NEW.vendor_id, NEW.vendor_id, 'owner'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.vendor_members
    WHERE vendor_id = NEW.vendor_id
    AND user_id = NEW.vendor_id
  );

  INSERT INTO public.notifications (
    recipient_user_id,
    vendor_id,
    order_id,
    type,
    title,
    body
  )
  SELECT
    vendor_members.user_id,
    NEW.vendor_id,
    NEW.id,
    'order_requested',
    'New order request: ' || NEW.order_number,
    NULL
  FROM public.vendor_members
  WHERE vendor_members.vendor_id = NEW.vendor_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_requested_notification ON public.orders;
CREATE TRIGGER on_order_requested_notification
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_requested_notification();
