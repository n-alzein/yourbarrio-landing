# public.users Empty Email Audit

Date: 2026-05-10

Scope: read-only investigation of `public.users.email` on staging (`crskbfbleiubpkvyvvlf`) and production (`nbzqnjanqkzuwyxnkjtr`). No production or staging data was changed.

## Summary

Some active business rows have `public.users.email` blank even though the linked Supabase Auth user exists and has an email.

Live read-only checks:

| Environment | Total `public.users` | Blank/null public email | Role breakdown | Auth linkage |
| --- | ---: | ---: | --- | --- |
| Staging | 29 | 1 | 1 business | 1/1 has `auth.users` row with non-empty email |
| Production | 40 | 3 | 3 business | 3/3 have `auth.users` rows with non-empty email |

Production affected rows from the read-only query:

| public id | business | internal | status | public email | auth email |
| --- | --- | ---: | --- | --- | --- |
| `28f17e2878` | Fashion Corner | false | active | blank | present |
| `f7f801219e` | The Coat Store | true | active | blank | present |
| `834bcb5d7c` | YourBarrio 2 | true | active | blank | present |

Staging affected row:

| public id | business | internal | status | public email | auth email |
| --- | --- | ---: | --- | --- | --- |
| `b10b65701b6d` | Shoreline Market | true | active | blank | present |

All affected rows have `auth.identities.provider = 'email'`. This does not appear to be a Google OAuth provider-data issue.

## Most Likely Root Cause

The root cause is an app/database write-path gap: business onboarding paths can create or update `public.users` without setting `email`, while `public.users.email` is nullable and not enforced as a mirror of `auth.users.email`.

The oldest affected rows predate the auth provisioning trigger added on 2026-04-22. The business onboarding RPC and API both write business profile fields to `public.users` and omit `email`. If a `public.users` row did not already exist, those paths can create a row whose email is `NULL`.

Current code can also preserve or re-blank the issue:

- `app/api/business/profile/route.js` includes `email` in the normal business profile update payload. If the request has `email: ""`, it writes blank. If the existing row is already blank/null and the request omits `email`, it writes `existingUser.email || ""`, preserving the blank as an empty string.
- `getCurrentAccountContext()` only repairs missing or tombstoned profile rows. A live row with blank email is treated as valid and is not repaired from `auth.users.email`.

## Files And Paths Involved

- `supabase/migrations/20251205204210_init.sql`: `public.users.email` is nullable (`email text`), so the database allows active rows without an email.
- `supabase/migrations/20260422120000_auth_user_profile_provisioning.sql`: creates `handle_auth_user_profile_provisioning()` as an `AFTER INSERT ON auth.users` trigger. It inserts `lower(NEW.email)` and backfills missing/tombstoned rows from `auth.users`, but it does not repair existing active rows with blank email and it does not handle later auth email changes.
- `supabase/migrations/20260215120000_create_business_from_onboarding_rpc.sql`: inserts into `public.users` without an `email` column.
- `supabase/migrations/20260510120000_separate_business_phone_and_internal_flags.sql`: current replacement for the same RPC still inserts into `public.users` without an `email` column.
- `app/api/businesses/route.js`: onboarding API builds `usersPayload` without `email`, then upserts into `public.users`.
- `app/api/business/profile/route.js`: profile save writes `email` from request body or from `existingUser.email || ""`.
- `lib/auth/getCurrentAccountContext.js`: recovery only runs for missing/tombstoned profiles, not blank-email active profiles.
- `lib/auth/ensureUserProvisioning.js`: if called, it can fill blank email from auth identity, but current account context does not call it for this state.
- `app/api/account/profile/route.js`: customer profile saves do not write email.
- `lib/accountDeletion/purgeUserAccount.ts` and `supabase/functions/_shared/finalize-overdue-deletions.ts`: deletion/anonymization sets placeholder deleted emails, not blank emails.
- `app/api/admin/users/[id]/email/route.ts`: updates `auth.users.email`; there is no matching `public.users.email` update here, so this can cause non-blank drift but does not explain blank emails.
- `app/api/users/[id]/route.js`: generic authenticated `PUT` blindly spreads request JSON into `public.users`. This is a broad risk if reachable, though it was not proven as the cause of the current rows.

## Answers To The Specific Questions

- Are the bad rows linked to real `auth.users` rows? Yes. All blank-email rows found in staging and production are linked to real auth rows.
- Do those linked `auth.users` rows have valid email? Yes, all affected linked auth rows have non-empty email.
- Is `public.users.email` nullable by design? The schema currently allows `NULL`, but product behavior expects active real accounts to mirror `auth.users.email`.
- Are `raw_user_meta_data.email`, `auth.users.email`, or provider identity data used inconsistently? Email provisioning uses `auth.users.email` in the trigger and `user.email` in app fallbacks. Metadata is used for name/avatar. The affected rows are email-provider identities, so provider metadata inconsistency is not the observed cause.
- Is any upsert doing `email = excluded.email` with null? The auth trigger avoids replacing an existing active email with null via `coalesce(public.users.email, EXCLUDED.email)`. The business onboarding RPC/API omit `email`, which can create null emails. The business profile route can update email to blank.
- Is any form/profile payload unintentionally setting email blank? Yes, `app/api/business/profile/route.js` accepts and writes `email`.
- Are business accounts created before auth email is available? Not likely. The auth rows have email. The problem is that some business profile creation paths did not copy it into `public.users`.
- Are seeded/demo accounts intentionally missing email? Some affected rows are internal, but production Fashion Corner is not internal. None of the affected rows are deleted/anonymized.

## Verification SQL

Read-only aggregate checks used:

```sql
with bad as (
  select u.*
  from public.users u
  where nullif(trim(u.email), '') is null
),
joined as (
  select
    b.public_id,
    b.role,
    coalesce(b.is_internal, false) as is_internal,
    b.account_status,
    b.created_at,
    b.updated_at,
    b.business_name,
    au.id is not null as has_auth_user,
    nullif(trim(au.email), '') is not null as auth_has_email
  from bad b
  left join auth.users au on au.id = b.id
)
select
  (select count(*) from public.users) as total_public_users,
  (select count(*) from bad) as blank_public_email_count,
  (select count(*) from public.users u join auth.users au on au.id = u.id
    where nullif(trim(u.email), '') is null
      and nullif(trim(au.email), '') is not null) as blank_public_email_auth_has_email_count;
```

Provider check:

```sql
with bad as (
  select id
  from public.users
  where nullif(trim(email), '') is null
)
select i.provider, count(distinct bad.id)
from bad
join auth.identities i on i.user_id = bad.id
group by i.provider
order by count(*) desc;
```

Drift check:

```sql
select count(*) as differs_from_auth_count
from public.users u
join auth.users au on au.id = u.id
where nullif(trim(u.email), '') is distinct from nullif(trim(lower(au.email)), '');
```

## Safe Fix Recommendation

1. Make app profile email read-only:
   - Remove `email` from `app/api/business/profile/route.js` update payload.
   - Ignore or reject client-submitted email in business/customer profile save APIs.
   - If email changes are allowed, route them through a dedicated auth email-change flow and then sync from `auth.users`.

2. Fix creation paths:
   - Add `email: user.email?.trim().toLowerCase()` to `app/api/businesses/route.js` when present.
   - Update `create_business_from_onboarding(p_payload jsonb)` to set `public.users.email` from the current auth row, or at minimum preserve/fill with `coalesce(nullif(public.users.email, ''), auth_email)`.

3. Improve repair/sync:
   - Treat active `public.users` rows with blank email and an authenticated `user.email` as repairable in `getCurrentAccountContext()` or `ensureUserProvisionedForUser()`.
   - Add a database sync trigger for `auth.users` email updates if `public.users.email` is intended to be a mirror.

4. Backfill after code guardrails are in place.

## Proposed Backfill SQL

Do not apply automatically. Review affected rows first, then run in staging before production.

```sql
-- Preview
select
  u.id,
  u.public_id,
  u.role,
  u.business_name,
  u.is_internal,
  u.account_status,
  u.created_at,
  u.updated_at,
  nullif(trim(u.email), '') is null as public_email_blank,
  nullif(trim(au.email), '') is not null as auth_email_present
from public.users u
join auth.users au on au.id = u.id
where nullif(trim(u.email), '') is null
  and nullif(trim(au.email), '') is not null
  and coalesce(u.account_status, 'active') <> 'deleted'
  and u.deleted_at is null
  and u.anonymized_at is null
order by u.updated_at desc nulls last;

-- Backfill
update public.users u
set
  email = lower(trim(au.email)),
  updated_at = now()
from auth.users au
where au.id = u.id
  and nullif(trim(u.email), '') is null
  and nullif(trim(au.email), '') is not null
  and coalesce(u.account_status, 'active') <> 'deleted'
  and u.deleted_at is null
  and u.anonymized_at is null;
```

## Regression Guardrails

- Unit test `app/api/business/profile/route.js` to prove profile saves never write `public.users.email`.
- Unit test `app/api/businesses/route.js` to prove onboarding includes auth email when creating/filling `public.users`.
- Migration test for `create_business_from_onboarding` to prove the insert includes/fills email and does not overwrite a non-empty email with blank.
- Unit test `getCurrentAccountContext()` recovery for an active row with blank `public.users.email` and non-empty auth email.
- Add a periodic read-only admin/ops check for active real rows where `public.users.email` is blank or differs from `auth.users.email`.

## Implementation Note

Implemented on 2026-05-10.

Files changed:

- `app/api/business/profile/route.js`: removed email from normal business profile update payloads. Client-submitted email is ignored because email changes must go through auth-owned flows.
- `app/api/businesses/route.js`: onboarding now fills `public.users.email` from authenticated `user.email` when non-empty, normalized with trim/lowercase. Onboarding form data cannot set email.
- `lib/auth/getCurrentAccountContext.js`: active non-tombstoned rows with blank public email are repaired from the authenticated user email and refetched.
- `app/api/admin/users/[id]/email/route.ts`: admin auth email changes now sync the `public.users.email` mirror after a successful auth update.
- Tests added/updated for profile saves, onboarding email fill, active blank-email repair, admin email sync, and migration SQL guardrails.

Migrations:

- `supabase/migrations/20260510123000_fill_user_email_in_business_onboarding_rpc.sql`
- `supabase/migrations/20260510124000_backfill_blank_public_user_emails_from_auth.sql`

Staging preview query to run before applying the backfill:

```sql
select
  u.id,
  u.public_id,
  u.role,
  u.business_name,
  u.is_internal,
  u.account_status,
  u.created_at,
  u.updated_at,
  nullif(trim(u.email), '') is null as public_email_blank,
  nullif(trim(au.email), '') is not null as auth_email_present
from public.users u
join auth.users au on au.id = u.id
where nullif(trim(u.email), '') is null
  and nullif(trim(au.email), '') is not null
  and coalesce(u.account_status, 'active') <> 'deleted'
  and u.deleted_at is null
  and u.anonymized_at is null
order by u.updated_at desc nulls last;
```

Rollout reminder: apply and verify in staging first, confirm only expected active rows are affected, then apply to production. Do not manually update production data outside the reviewed migration path.

Validation:

- Passed: `npx vitest run tests/business-profile-route-phone.unit.test.ts tests/businesses-onboarding-route.unit.test.ts tests/current-account-context-provisioning.unit.test.ts tests/ensure-user-provisioning.unit.test.ts tests/onboarding-rpc-migration.unit.test.ts tests/admin-user-email-route.unit.test.ts`
- Passed: `npx eslint app/api/business/profile/route.js app/api/businesses/route.js lib/auth/getCurrentAccountContext.js 'app/api/admin/users/[id]/email/route.ts'`
- Note: `npm run lint -- --file ...` was not used because this repo's flat ESLint config rejects the legacy `--file` option.
