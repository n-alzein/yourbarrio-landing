# Admin Moderation Audit Signature Fix

Date: 2026-05-11

## Summary

The production `/admin/moderation` page was fixed after it showed a red Postgres function-signature error while loading the moderation queue.

Applied migration:

- `supabase/migrations/20260511120000_fix_moderation_audit_log_signature.sql`

The production page now loads without the `log_admin_action` signature error or the `Failed to load moderation queue` banner.

## Root Cause

Moderation admin RPCs were resolving audit logging against the wrong `public.log_admin_action` overload/signature.

The failing error was:

```text
function public.log_admin_action(unknown, unknown, text, jsonb, uuid) does not exist
```

Staging and production had different audit-function overload history and argument names, so named SQL calls were fragile.

## Files / Migration Changed

- `supabase/migrations/20260511120000_fix_moderation_audit_log_signature.sql`
- `app/admin/actions.ts`
- `tests/admin-moderation-actions.unit.test.ts`
- `tests/admin-moderation-audit-migration.unit.test.ts`

The migration rebuilds moderation RPCs to call the canonical audit function positionally:

```text
public.log_admin_action(text, uuid, text, text, jsonb)
```

## Production Deployment Status

- Staging project `crskbfbleiubpkvyvvlf`: migration applied.
- Production project `nbzqnjanqkzuwyxnkjtr`: migration applied.
- Production `/admin/moderation` manually verified at `https://www.yourbarrio.com/admin/moderation`.

## Validation

Commands run:

```bash
npm run test:unit -- --run tests/admin-moderation-actions.unit.test.ts tests/admin-moderation-audit-migration.unit.test.ts
npm run lint
```

Production metadata checks confirmed:

- `public.log_admin_action(text, uuid, text, text, jsonb)` exists.
- Moderation RPCs exist:
  - `public.admin_update_moderation_flag(uuid, text, text, jsonb)`
  - `public.admin_take_moderation_case(uuid)`
  - `public.admin_hide_listing_and_resolve_flag(uuid, uuid, text)`
  - `public.admin_hide_review_and_resolve_flag(uuid, uuid, text)`
- Moderation RPC bodies call `public.log_admin_action(...)` positionally and do not use named audit args such as `p_action =>`.

## Not Manually Tested

- Production Take case, Resolve, and Dismiss actions were not manually executed to avoid altering real moderation cases.
- Raw production action-failure UI was not forced manually. Signature-error hiding is covered by regression tests.

## Follow-Up Guidance

- Future admin audit calls should target the canonical signature: `log_admin_action(text, uuid, text, text, jsonb)`.
- Prefer positional calls inside SQL RPCs when staging and production argument names may drift.
- Do not add another audit-function overload unless there is a clear compatibility reason.
- If production action testing is needed, use an approved disposable moderation case or explicitly approved existing case IDs.
