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

ALTER TABLE IF EXISTS public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_role_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.moderation_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_tickets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_roles' AND policyname = 'Admins can read roles'
  ) THEN
    CREATE POLICY "Admins can read roles"
      ON public.admin_roles
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_roles' AND policyname = 'Super admins can mutate roles'
  ) THEN
    CREATE POLICY "Super admins can mutate roles"
      ON public.admin_roles
      FOR ALL
      TO authenticated
      USING (public.has_admin_role('admin_super'))
      WITH CHECK (public.has_admin_role('admin_super'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_role_members' AND policyname = 'Admins can read role members'
  ) THEN
    CREATE POLICY "Admins can read role members"
      ON public.admin_role_members
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_role_members' AND policyname = 'Super admins can mutate role members'
  ) THEN
    CREATE POLICY "Super admins can mutate role members"
      ON public.admin_role_members
      FOR ALL
      TO authenticated
      USING (public.has_admin_role('admin_super'))
      WITH CHECK (public.has_admin_role('admin_super'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_log' AND policyname = 'Admins can read audit log'
  ) THEN
    CREATE POLICY "Admins can read audit log"
      ON public.admin_audit_log
      FOR SELECT
      TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_audit_log' AND policyname = 'Admins can insert audit log'
  ) THEN
    CREATE POLICY "Admins can insert audit log"
      ON public.admin_audit_log
      FOR INSERT
      TO authenticated
      WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_impersonation_sessions' AND policyname = 'Impersonation actor can read own sessions'
  ) THEN
    CREATE POLICY "Impersonation actor can read own sessions"
      ON public.admin_impersonation_sessions
      FOR SELECT
      TO authenticated
      USING (
        actor_user_id = auth.uid()
        OR public.has_admin_role('admin_super')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_impersonation_sessions' AND policyname = 'Support ops super can create impersonation sessions'
  ) THEN
    CREATE POLICY "Support ops super can create impersonation sessions"
      ON public.admin_impersonation_sessions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_admin_role('admin_support')
        OR public.has_admin_role('admin_ops')
        OR public.has_admin_role('admin_super')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'admin_impersonation_sessions' AND policyname = 'Actor or super can update impersonation sessions'
  ) THEN
    CREATE POLICY "Actor or super can update impersonation sessions"
      ON public.admin_impersonation_sessions
      FOR UPDATE
      TO authenticated
      USING (
        actor_user_id = auth.uid()
        OR public.has_admin_role('admin_super')
      )
      WITH CHECK (
        actor_user_id = auth.uid()
        OR public.has_admin_role('admin_super')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'moderation_flags' AND policyname = 'Users can create own moderation flags'
  ) THEN
    CREATE POLICY "Users can create own moderation flags"
      ON public.moderation_flags
      FOR INSERT
      TO authenticated
      WITH CHECK (created_by_user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'moderation_flags' AND policyname = 'Users can read own moderation flags'
  ) THEN
    CREATE POLICY "Users can read own moderation flags"
      ON public.moderation_flags
      FOR SELECT
      TO authenticated
      USING (
        created_by_user_id = auth.uid()
        OR target_user_id = auth.uid()
        OR public.is_admin()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'moderation_flags' AND policyname = 'Admins can update moderation flags'
  ) THEN
    CREATE POLICY "Admins can update moderation flags"
      ON public.moderation_flags
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'Users can create own tickets'
  ) THEN
    CREATE POLICY "Users can create own tickets"
      ON public.support_tickets
      FOR INSERT
      TO authenticated
      WITH CHECK (requester_user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'Users can read own tickets'
  ) THEN
    CREATE POLICY "Users can read own tickets"
      ON public.support_tickets
      FOR SELECT
      TO authenticated
      USING (
        requester_user_id = auth.uid()
        OR public.is_admin()
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'Admins can update tickets'
  ) THEN
    CREATE POLICY "Admins can update tickets"
      ON public.support_tickets
      FOR UPDATE
      TO authenticated
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
