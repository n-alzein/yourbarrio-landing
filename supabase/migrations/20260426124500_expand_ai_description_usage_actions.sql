ALTER TABLE public.ai_description_usage
  DROP CONSTRAINT IF EXISTS ai_description_usage_action_valid;

ALTER TABLE public.ai_description_usage
  ADD CONSTRAINT ai_description_usage_action_valid
  CHECK (
    action IN (
      'generate',
      'regenerate',
      'make_shorter',
      'more_premium',
      'more_casual',
      'add_details'
    )
  );
