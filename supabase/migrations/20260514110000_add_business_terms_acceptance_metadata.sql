ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS business_terms_version text,
  ADD COLUMN IF NOT EXISTS business_terms_accepted_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_terms_acceptance_user_agent text,
  ADD COLUMN IF NOT EXISTS business_terms_acceptance_ip_hash text;

COMMENT ON COLUMN public.businesses.business_terms_accepted_at IS
  'Timestamp when the business owner accepted the YourBarrio business onboarding legal terms.';
COMMENT ON COLUMN public.businesses.business_terms_version IS
  'Version label of the business onboarding legal terms accepted by the business owner.';
COMMENT ON COLUMN public.businesses.business_terms_accepted_by_user_id IS
  'User who accepted the business onboarding legal terms for this business.';
COMMENT ON COLUMN public.businesses.business_terms_acceptance_user_agent IS
  'User agent captured when the business onboarding legal terms were accepted.';
COMMENT ON COLUMN public.businesses.business_terms_acceptance_ip_hash IS
  'Optional hashed IP value for future acceptance audit use; raw IP addresses should not be stored here.';

CREATE INDEX IF NOT EXISTS idx_businesses_terms_accepted_by_user_id
  ON public.businesses (business_terms_accepted_by_user_id);

CREATE INDEX IF NOT EXISTS idx_businesses_terms_accepted_at
  ON public.businesses (business_terms_accepted_at);

CREATE OR REPLACE FUNCTION public.enforce_business_terms_acceptance_for_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_status IN ('auto_verified', 'manually_verified')
     AND (
       TG_OP = 'INSERT'
       OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     )
     AND (
       NEW.business_terms_accepted_at IS NULL
       OR NULLIF(btrim(COALESCE(NEW.business_terms_version, '')), '') IS NULL
       OR NEW.business_terms_accepted_by_user_id IS NULL
     ) THEN
    RAISE EXCEPTION 'Business Terms acceptance is required before a business can be verified.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_businesses_terms_acceptance_before_verification ON public.businesses;
CREATE TRIGGER trg_businesses_terms_acceptance_before_verification
  BEFORE INSERT OR UPDATE OF verification_status ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_business_terms_acceptance_for_verification();

COMMENT ON FUNCTION public.enforce_business_terms_acceptance_for_verification() IS
  'Prevents future business verification transitions unless Business Terms acceptance metadata is present.';
