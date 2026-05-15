CREATE TABLE IF NOT EXISTS public.user_legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  user_agent text,
  ip_hash text,
  CONSTRAINT user_legal_acceptances_consent_type_check
    CHECK (consent_type IN ('terms_of_service', 'privacy_policy_acknowledgement')),
  CONSTRAINT user_legal_acceptances_source_check
    CHECK (source IN ('signup', 'oauth_completion', 'checkout', 'reacceptance'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_legal_acceptances_user_type_version
  ON public.user_legal_acceptances (user_id, consent_type, version);

CREATE INDEX IF NOT EXISTS idx_user_legal_acceptances_user_id
  ON public.user_legal_acceptances (user_id);

CREATE INDEX IF NOT EXISTS idx_user_legal_acceptances_type_version
  ON public.user_legal_acceptances (consent_type, version);

COMMENT ON TABLE public.user_legal_acceptances IS
  'Versioned audit records for customer legal terms acceptance and privacy policy acknowledgement.';
COMMENT ON COLUMN public.user_legal_acceptances.user_id IS
  'Public user who accepted or acknowledged the legal document.';
COMMENT ON COLUMN public.user_legal_acceptances.consent_type IS
  'Legal consent category, such as terms_of_service or privacy_policy_acknowledgement.';
COMMENT ON COLUMN public.user_legal_acceptances.version IS
  'Version label of the legal document accepted or acknowledged.';
COMMENT ON COLUMN public.user_legal_acceptances.accepted_at IS
  'Timestamp when the legal consent was recorded.';
COMMENT ON COLUMN public.user_legal_acceptances.source IS
  'Product flow where the legal consent was captured.';
COMMENT ON COLUMN public.user_legal_acceptances.user_agent IS
  'Request user-agent captured with the legal consent when available.';
COMMENT ON COLUMN public.user_legal_acceptances.ip_hash IS
  'Optional hashed IP value for future legal acceptance audit use; raw IP addresses should not be stored here.';
