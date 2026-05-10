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

-- Safe one-time mirror repair:
-- Only active, non-deleted, non-anonymized public.users rows with blank email
-- are filled from the matching auth.users.email. Existing non-empty public
-- emails and deleted/anonymized account placeholders are intentionally left
-- untouched.
UPDATE public.users u
SET
  email = lower(trim(au.email)),
  updated_at = now()
FROM auth.users au
WHERE au.id = u.id
  AND NULLIF(trim(u.email), '') IS NULL
  AND NULLIF(trim(au.email), '') IS NOT NULL
  AND COALESCE(u.account_status, 'active') <> 'deleted'
  AND u.deleted_at IS NULL
  AND u.anonymized_at IS NULL;
