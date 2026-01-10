-- Messaging: conversations + messages with RLS, triggers, and RPC helpers

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  customer_unread_count int NOT NULL DEFAULT 0,
  business_unread_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'conversations_customer_business_key'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_customer_business_key UNIQUE (customer_id, business_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS conversations_customer_last_message_idx
  ON public.conversations (customer_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS conversations_business_last_message_idx
  ON public.conversations (business_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id),
  recipient_id uuid NOT NULL REFERENCES public.users(id),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS messages_recipient_read_idx
  ON public.messages (recipient_id, read_at);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_message_insert()
RETURNS trigger AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      last_message_preview = NEW.body,
      customer_unread_count = CASE
        WHEN NEW.recipient_id = customer_id THEN customer_unread_count + 1
        ELSE customer_unread_count
      END,
      business_unread_count = CASE
        WHEN NEW.recipient_id = business_id THEN business_unread_count + 1
        ELSE business_unread_count
      END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_message_insert ON public.messages;
CREATE TRIGGER on_message_insert
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.handle_message_insert();

DROP FUNCTION IF EXISTS public.get_or_create_conversation(uuid, uuid);
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_customer_id uuid,
  p_business_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  convo_id uuid;
  customer_role text;
  business_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF auth.uid() <> p_customer_id THEN
    RAISE EXCEPTION 'Only the customer can start a conversation';
  END IF;

  IF p_customer_id = p_business_id THEN
    RAISE EXCEPTION 'Customer and business must be different users';
  END IF;

  SELECT role INTO customer_role FROM public.users WHERE id = p_customer_id;
  SELECT role INTO business_role FROM public.users WHERE id = p_business_id;

  IF customer_role IS NULL OR business_role IS NULL THEN
    RAISE EXCEPTION 'Invalid participants';
  END IF;

  IF customer_role <> 'customer' OR business_role <> 'business' THEN
    RAISE EXCEPTION 'Conversation must be between customer and business';
  END IF;

  INSERT INTO public.conversations (customer_id, business_id)
  VALUES (p_customer_id, p_business_id)
  ON CONFLICT (customer_id, business_id) DO NOTHING
  RETURNING id INTO convo_id;

  IF convo_id IS NULL THEN
    SELECT id INTO convo_id
    FROM public.conversations
    WHERE customer_id = p_customer_id
      AND business_id = p_business_id;
  END IF;

  RETURN convo_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(
  conversation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  convo_customer uuid;
  convo_business uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT customer_id, business_id
  INTO convo_customer, convo_business
  FROM public.conversations
  WHERE id = conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  UPDATE public.messages
  SET read_at = now()
  WHERE conversation_id = mark_conversation_read.conversation_id
    AND recipient_id = auth.uid()
    AND read_at IS NULL;

  IF auth.uid() = convo_customer THEN
    UPDATE public.conversations
    SET customer_unread_count = 0
    WHERE id = mark_conversation_read.conversation_id;
  ELSIF auth.uid() = convo_business THEN
    UPDATE public.conversations
    SET business_unread_count = 0
    WHERE id = mark_conversation_read.conversation_id;
  ELSE
    RAISE EXCEPTION 'Not a conversation participant';
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Participants can read conversations'
  ) THEN
    CREATE POLICY "Participants can read conversations"
      ON public.conversations FOR SELECT
      USING (auth.uid() = customer_id OR auth.uid() = business_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Customers can create conversations'
  ) THEN
    CREATE POLICY "Customers can create conversations"
      ON public.conversations FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = customer_id
        AND customer_id <> business_id
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = customer_id AND u.role = 'customer'
        )
        AND EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = business_id AND u.role = 'business'
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Block conversation updates'
  ) THEN
    CREATE POLICY "Block conversation updates"
      ON public.conversations FOR UPDATE
      USING (false);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Participants can read messages'
  ) THEN
    CREATE POLICY "Participants can read messages"
      ON public.messages FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = conversation_id
            AND (c.customer_id = auth.uid() OR c.business_id = auth.uid())
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Participants can send messages'
  ) THEN
    CREATE POLICY "Participants can send messages"
      ON public.messages FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = sender_id
        AND sender_id <> recipient_id
        AND EXISTS (
          SELECT 1
          FROM public.conversations c
          WHERE c.id = conversation_id
            AND (
              (c.customer_id = sender_id AND c.business_id = recipient_id)
              OR
              (c.business_id = sender_id AND c.customer_id = recipient_id)
            )
        )
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Recipients can mark read'
  ) THEN
    CREATE POLICY "Recipients can mark read"
      ON public.messages FOR UPDATE TO authenticated
      USING (recipient_id = auth.uid())
      WITH CHECK (recipient_id = auth.uid());
  END IF;
END$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Participants can read user profiles'
  ) THEN
    DROP POLICY "Participants can read user profiles" ON public.users;
  END IF;

  CREATE POLICY "Participants can read user profiles"
    ON public.users FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (
          (c.customer_id = public.users.id AND c.business_id = auth.uid())
          OR (c.business_id = public.users.id AND c.customer_id = auth.uid())
        )
      )
    );
END$$;
