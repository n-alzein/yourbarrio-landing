# Admin Platform

## What this adds
- New admin schema objects for roles, audit logging, moderation, support, and support-mode sessions.
- New App Router section at `/admin` with dashboard, users, businesses, moderation, support, audit, and impersonation pages.
- Server-only admin mutations using Server Actions with zod input validation and audit logging.

## 1) Run migrations
This project uses Supabase SQL migrations in `supabase/migrations`.

Run your normal migration flow, for example:

```bash
supabase db push
```

Added migration files:
- `supabase/migrations/001_admin_platform_core.sql`
- `supabase/migrations/002_admin_platform_rls.sql` (optional hardening phase)

Notes:
- `001` creates tables/functions/indexes for the admin platform.
- `002` enables RLS and admin policies for those new tables.
- `002` is intentionally optional for initial testing.

## 2) Grant first `admin_super`

### Option A: SQL

```sql
insert into public.admin_role_members (user_id, role_key, granted_by)
values ('<USER_UUID>', 'admin_super', '<USER_UUID>')
on conflict (user_id, role_key) do nothing;
```

### Option B: Script by email

```bash
node scripts/grant-admin-super.mjs user@example.com
```

Required env vars for script:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 3) Admin access controls
- `/admin` is enforced server-side in `app/admin/layout.tsx` via `requireAdmin()`.
- Non-admin users are redirected to `/`.
- Role checks are enforced with `requireAdminRole(...)` for mutation pages and actions.

Role hierarchy:
- `admin_readonly`
- `admin_support`
- `admin_ops`
- `admin_super`

## 4) Development toggles

### Dev allowlist (guard fallback)
If RPC/policies are not ready yet, allow specific emails in development:

```bash
ADMIN_DEV_ALLOW_EMAILS="a@b.com,c@d.com"
```

- Used only when `NODE_ENV !== 'production'`.
- Admin UI shows a warning banner when this path is active.

### DEV-only RLS bypass for admin reads/writes

```bash
ADMIN_BYPASS_RLS=true
```

- Used only when `NODE_ENV !== 'production'`.
- Enables server-side service-role client for admin data access.
- Never expose service role key to browser code.

### DEV-only strict permission bypass

```bash
ADMIN_DEV_BYPASS_PERMISSIONS=true
```

- Used only when `NODE_ENV !== 'production'`.
- Allows dev-allowlisted users to bypass strict role checks.
- Default is OFF.

## 5) Support mode (view-as)
- Start from `/admin/users/[id]` or `/admin/impersonation`.
- Creates an `admin_impersonation_sessions` row and sets:
  - `yb_impersonate_user_id`
  - `yb_impersonate_session_id`
- Layout banner indicates active view-as and supports exit.
- Exiting clears cookies, deactivates session, and writes an audit log event.
- This is not true auth token impersonation.

## 6) Production hardening checklist
Before production rollout:
- Remove/disable `ADMIN_DEV_ALLOW_EMAILS`.
- Remove/disable `ADMIN_BYPASS_RLS`.
- Remove/disable `ADMIN_DEV_BYPASS_PERMISSIONS`.
- Apply `supabase/migrations/002_admin_platform_rls.sql`.
- Remove `public_read_users` from `public.users` and replace with safe public profile access (view or RPC).
- Enforce MFA/2FA on admin accounts.
- Define and enforce audit log retention/archival policy.
- Add rate limiting around admin mutation endpoints/actions.
- Restrict admin route exposure at edge/network layer where possible.

## 7) Local smoke test
1. Run migrations.
2. Grant one `admin_super` user.
3. Start app: `npm run dev`.
4. Log in as non-admin and visit `/admin` -> redirect to `/`.
5. Log in as admin and visit `/admin` -> dashboard + nav visible.
6. Verify:
   - `/admin/users` list + detail open.
   - moderation create/update works.
   - support ticket create/update works.
   - audit entries are created for each mutation.
   - support mode start/stop shows banner and audit events.
