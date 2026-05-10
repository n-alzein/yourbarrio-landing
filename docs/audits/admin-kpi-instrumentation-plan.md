# Admin KPI Instrumentation Plan

## Implemented Now

The first prelaunch KPI pass uses aggregate counts from existing tables only.

- Launch-ready businesses
- Published listings
- Published real listings
- Demo/internal listings
- Pending business verifications
- Businesses with no published real listings
- Businesses with incomplete launch profiles
- Draft listings
- Listings missing image, price, or description
- Open moderation flags
- Open support tickets
- Customer accounts and new customers in the last 7 days
- Saved businesses and saved listings totals, with last 7 days shown as helper text when those tables are available
- Active carts, cart additions in the last 7 days, and orders in the last 7 days when those tables are available
- Business activation funnel
- Listings created over time, split by real versus demo/internal inventory
- Published inventory composition

## Launch-Ready Definition

A business counts as launch-ready when it is:

- not internal/test-only
- not seeded/demo content
- not suspended through `verification_status = 'suspended'`
- has `business_name`, `city`, `category`, and `description`
- has at least one published real listing

Verification is shown separately and is not required for this first launch-ready calculation. Payment readiness is intentionally not included yet because launch payment policy is not encoded clearly enough for this dashboard KPI.

## Current KPI Definitions

- Pending verification: exact count of rows in `public.businesses` where `verification_status = 'pending'`. This intentionally matches the admin sidebar badge and `/admin/verification` pending queue count.
- Published listings: listings with `status = 'published'`, not `admin_hidden`, and not seller-deleted. This includes demo/seeded listings.
- Published real listings: published listings excluding listing-level seeded/internal/test flags and excluding seeded/internal/suspended businesses. Verification is not required for this inventory-readiness metric.
- Demo/internal listings: published listings excluded from real inventory because the listing or business is seeded/demo, internal/test, suspended, or missing a business row. This bucket is derived from the same published-listing base set as `Published listings` and `Published real listings`.
- Launch-ready businesses: non-internal, non-seeded, non-suspended businesses with `business_name`, `city`, `category`, `description`, and at least one published real listing.
- Saved businesses: total rows in `public.saved_businesses`; helper text shows rows created in the last 7 days.
- Saved listings: total rows in `public.saved_listings`; helper text shows rows created in the last 7 days.
- Customer intent: 7-day aggregate of saved businesses, saved listings, cart item additions, and orders. Checkout starts are not included because there is no dedicated checkout-start event yet.

## Business Activation Funnel

The dashboard funnel is a compact prelaunch view of where business accounts are getting stuck:

- Business accounts: total `public.users` rows where `role = 'business'`.
- Profiles completed: eligible non-internal, non-seeded, non-suspended businesses with `business_name`, `city`, `category`, and `description`.
- Pending verification: exact pending verification count, meaning businesses currently waiting for admin review with `verification_status = 'pending'`. This matches the sidebar Verification badge and does not include already verified businesses.
- Has real listing: eligible businesses with at least one published real listing.
- Launch-ready: eligible businesses with a complete launch profile and at least one published real listing.

The funnel intentionally mixes account-level and business-profile-level stages because account creation and business readiness are separate records in the current schema.

## Listing Activity

`Listings created` uses `public.listings.created_at` over the last 30 days. It excludes admin-hidden, seller-deleted, archived, and deleted listing records.

- Real created: active listing records not marked seeded/internal/test and owned by an eligible non-internal, non-seeded, non-suspended business.
- Demo/internal created: active listing records in the same 30-day window that do not meet the real-created definition, including listing-level demo/test/internal content and listings owned by demo/internal/suspended or missing business records.

The chart does not require a listing to be published because it measures creation activity, not public inventory.

## Published Inventory Composition

The dashboard replaces the Audit preview with a published inventory composition card:

- Published total: the same value as `Published listings`.
- Real inventory: the same value as `Published real listings`.
- Demo/internal: the same value as `Demo/internal listings`.

The expected relationship is:

```text
Published listings = Published real listings + Demo/internal listings
```

If a future excluded category is added, it should be documented here and surfaced in the UI instead of hidden in the math.

Audit logs remain available on `/admin/audit`; they are no longer shown as a main-dashboard preview because launch readiness and marketplace inventory are higher-value prelaunch signals.

## Deferred KPIs

These are not implemented because the app does not yet expose reliable aggregate tracking for them:

- Listing views
- Business profile views
- Search volume and zero-result searches
- Customer intent trends from timestamped events
- Checkout starts
- Checkout failures
- Failed image uploads
- Failed image enhancements
- Failed Stripe webhooks
- Recent client errors
- Funnel drop-off by onboarding step

## Suggested Future Events

Add aggregate-safe event tracking before exposing these KPIs:

- `listing_viewed`
- `business_profile_viewed`
- `search_performed`
- `search_zero_results`
- `listing_saved`
- `business_saved`
- `cart_item_added`
- `checkout_started`
- `checkout_failed`
- `image_upload_failed`
- `image_enhancement_failed`
- `webhook_failed`
- `client_error_logged`
- `business_onboarding_step_completed`

Recommended aggregation windows:

- last 24h
- last 7d
- last 30d

Store enough metadata to aggregate by role, entity type, and success/failure state, but avoid exposing raw user behavior on the admin dashboard unless a workflow specifically requires it.
