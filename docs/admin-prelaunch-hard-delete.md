# Pre-Launch Fake/Test User Hard Delete

This operation is a super-admin-only cleanup tool for fake, test, seeded, or internal accounts created before launch. It is not the normal customer deletion flow and does not replace account anonymization, deactivation, or retention workflows.

## Eligibility

A target user must be marked as pre-launch deletable by one of these markers:

- `public.users.allow_hard_delete = true`
- `public.users.is_internal = true`
- legacy `is_test` or `is_seeded` markers if present in a deployed schema
- an owned business marked `businesses.is_internal = true` for the admin UI affordance

Normal real users are blocked with:

`This user is not marked as fake, test, or internal. Use the normal account deletion/anonymization flow instead.`

## Production Guard

Hard delete is available by default outside production. In production, the API requires:

`ALLOW_PRELAUNCH_HARD_DELETE=true`

Without that variable, preview and execute requests are rejected before any cleanup work.

## Dry Run

Use the admin user detail page action, or call:

```http
POST /api/admin/users/{user_id}/hard-delete
Content-Type: application/json

{ "mode": "dry_run" }
```

The preview returns counts by table/type and storage objects that would be removed.

## Execute

Execution requires the exact confirmation text:

```http
POST /api/admin/users/{user_id}/hard-delete
Content-Type: application/json

{ "mode": "execute", "confirmation": "HARD DELETE USER" }
```

The API runs the public-schema cleanup RPC first, deletes returned Supabase Storage objects, then deletes the Supabase Auth user last with the service-role Admin API.

## Schema Semantics

In the current YourBarrio schema, `listings.business_id` stores the business owner user id. The hard delete migration intentionally follows those current semantics. If the schema later changes so `listings.business_id` points to `businesses.id`, update and re-test this hard-delete logic before using it.

## Deletion Coverage

The cleanup explicitly targets fake/test data tied to the user, owned businesses, and owned listings, including profiles, businesses, listings, listing variants and attributes, saved listings/businesses, carts, unpaid/test orders, order items, inventory reservations, notifications, order notifications, conversations, messages, vendor memberships, AI onboarding/listing usage rows, moderation flags, notes/impersonation sessions for the target, and media assets. Admin audit rows are intentionally preserved.

Storage cleanup removes paths returned from `media_assets` path columns such as source/original/thumb/card/detail/cover/avatar/enhanced paths.

## Blocks

Execution is blocked when the target has real commerce records, including paid orders, Stripe checkout/payment/charge references, or order statuses that should be retained for accounting/legal reasons. It also blocks conversations with users that are not marked internal/test/seeded/deletable.

Blocked commerce message:

`This user has real commerce records and cannot be hard deleted.`

## Rollback

There is no application-level rollback after execute. Recovery requires restoring from a database and storage backup.
