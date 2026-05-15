ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_legal_acceptances FROM PUBLIC;
REVOKE ALL ON TABLE public.user_legal_acceptances FROM anon;
REVOKE ALL ON TABLE public.user_legal_acceptances FROM authenticated;

GRANT SELECT ON TABLE public.user_legal_acceptances TO authenticated;
GRANT ALL ON TABLE public.user_legal_acceptances TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_legal_acceptances'
      AND policyname = 'Users can read own legal acceptances'
  ) THEN
    CREATE POLICY "Users can read own legal acceptances"
      ON public.user_legal_acceptances
      FOR SELECT
      TO authenticated
      USING (user_id = (SELECT auth.uid()));
  END IF;
END;
$$;

COMMENT ON POLICY "Users can read own legal acceptances"
  ON public.user_legal_acceptances IS
  'Allows authenticated users to read only their own legal acceptance audit records; writes are server-side only.';
