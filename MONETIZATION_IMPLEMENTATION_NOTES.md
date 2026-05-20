# Monetization Implementation Notes

## What was implemented

This adds a silent monetization foundation for business entitlements, internal plans, usage limits, Stripe Billing readiness, admin controls, and future marketplace take-rate calculation. It does not add a public pricing page or require businesses to pay.

## Tables added

Migration: `supabase/migrations/20260519170000_monetization_foundation.sql`

- `monetization_plans`
- `monetization_features`
- `monetization_plan_entitlements`
- `business_subscriptions`
- `business_entitlement_overrides`
- `business_feature_usage`
- `monetization_audit_events`
- `stripe_webhook_events`

Existing businesses are backfilled to `founding_business`, and a trigger assigns the same default to newly inserted businesses.

## Feature keys seeded

Seeded features include inventory mode gates, listing limits, AI photo/description usage, analytics, order modes, messaging, featured placement credits, promotions, team member limits, storefront customization, priority support, and marketplace fee settings.

## Plan defaults

Seeded plans:

- `founding_business`
- `free`
- `starter`
- `pro`
- `premium`
- `custom`

All seeded marketplace take-rate settings are `0` during beta. `founding_business` is the default and keeps online stock plus generous beta access.

## Entitlement resolution

Central service:

- `lib/monetization/features.ts`
- `lib/monetization/entitlements.ts`
- `lib/monetization/fees.ts`

Resolution precedence:

1. Active deny override
2. Active grant/set/increase override
3. Business subscription plan
4. Default feature value
5. Safe founding fallback

`canceled` subscriptions resolve through the `free` plan when possible. Missing subscriptions fall back to `founding_business` so existing beta businesses are not locked out.

## Admin overrides

Admin endpoints:

- `POST /api/admin/businesses/:businessId/monetization/plan`
- `POST /api/admin/businesses/:businessId/monetization/overrides`
- `DELETE /api/admin/businesses/:businessId/monetization/overrides/:overrideId`
- `POST /api/admin/businesses/:businessId/monetization/usage/reset`

These require an existing admin role. Business owners can read status but cannot edit plans or overrides.

Override semantics:

- `deny` wins over every other override and plan entitlement.
- `grant` enables a boolean feature.
- `set_limit` replaces the plan/default limit.
- `increase_limit` is additive and intentionally stacks, including on top of `set_limit`.
- Expired or inactive overrides are ignored.

## RLS exposure

Business owners can read only their own `business_subscriptions`, `business_entitlement_overrides`, and `business_feature_usage`; admins can read these for support/ops workflows. `stripe_webhook_events` has RLS enabled and is only granted to `service_role`, because raw webhook payloads can include Stripe identifiers and operational metadata. `monetization_plan_entitlements` is not blanket-readable: direct client reads are limited to public active plans, plans assigned to the current business owner, or admins.

## Usage counters

Metered usage is stored in `business_feature_usage`. The service uses monthly UTC periods and the `consume_business_feature_usage` RPC to increment usage atomically. AI photo enhancement and AI description generation now check and consume monthly usage after successful work.

Concurrency behavior: `consume_business_feature_usage` inserts/locks the period row with `FOR UPDATE` before incrementing, so when one use remains, two near-simultaneous consumption attempts cannot both succeed. Failed AI photo enhancement or description generation does not consume usage; consumption happens only after the provider call and storage/logging path succeeds.

## Stripe Billing readiness

Billing helpers live in `lib/monetization/stripeBilling.ts`.

Disabled-by-default endpoints:

- `POST /api/businesses/:businessId/billing/checkout`
- `POST /api/businesses/:businessId/billing/portal`

Required env vars when enabling:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_BILLING_ENABLED=true`
- `BILLING_CHECKOUT_ENABLED=true`
- `BILLING_PORTAL_ENABLED=true`

Checkout uses Stripe Prices through plan mappings or lookup keys. No production price IDs are hardcoded.

## Stripe webhooks

Existing `POST /api/stripe/webhook` was extended and `POST /api/stripe/webhooks` was added as an alias. Billing events are recorded in `stripe_webhook_events` and monetization outcomes are logged to `monetization_audit_events`. Existing order/Connect event behavior is preserved.

Idempotency behavior: the existing `stripe_events` table remains the processing gate. Duplicate Stripe event IDs return early with `duplicate: true` before any order or billing handler runs. `stripe_webhook_events` stores the billing/webhook audit state; successful events are marked `processed`, and failed processing records `failed` plus the error message while removing the processing gate row so Stripe retries can process again.

## Marketplace take-rate

`calculateMarketplaceFeeForOrder` uses:

- `marketplace.take_rate_percent`
- `marketplace.fixed_fee_cents`
- `MARKETPLACE_TAKE_RATE_ENABLED`

When `MARKETPLACE_TAKE_RATE_ENABLED=false`, fees are always `0`. The existing Stripe Connect checkout only sends `application_fee_amount` when the calculated fee is greater than zero.

## Listing limits

Because the current listing editor writes directly to Supabase from the browser, active listing limit enforcement is added at the database boundary with `enforce_business_active_listing_limit`. Drafts remain allowed.

The trigger counts listings with `status = 'published'`, `admin_hidden = false`, and `deleted_at IS NULL`. It fires on insert and on updates to `status`, `admin_hidden`, or `deleted_at`, so restoring a hidden/deleted published listing is checked against the active limit. Current listing ownership is legacy-shaped: `listings.business_id` stores the business owner user id, while monetization uses `businesses.id`; the trigger documents and resolves this through `businesses.owner_user_id`.

## Assumptions

- `businesses.id` is the canonical business entity ID for monetization.
- `listings.business_id` currently stores the business owner user ID, so the listing limit trigger maps through `businesses.owner_user_id`.
- There is no dedicated admin business detail monetization UI yet, so admin APIs were implemented and documented instead of adding a new admin page pattern.
- Existing POS, unique-item, and capacity inventory modes were not implemented; only entitlement gates were seeded.
- Existing marketplace checkout used a hardcoded platform fee. The new fee abstraction makes that fee zero unless the take-rate flag is enabled.

## Commands run

- `npm run test:unit -- tests/monetization-entitlements.unit.test.ts tests/monetization-fees.unit.test.ts tests/monetization-migration.unit.test.ts`
- `npm run test:unit -- --run tests/monetization-entitlements.unit.test.ts tests/monetization-fees.unit.test.ts tests/monetization-migration.unit.test.ts tests/monetization-api-permissions.unit.test.ts`
- `npm run test:unit -- --run tests/monetization-entitlements.unit.test.ts tests/monetization-fees.unit.test.ts tests/monetization-migration.unit.test.ts tests/monetization-api-permissions.unit.test.ts tests/stripe-webhook-monetization.unit.test.ts tests/images-enhance-route.unit.test.ts tests/ai-description-route.unit.test.ts`
- `npm run lint`
- `npm run build`
