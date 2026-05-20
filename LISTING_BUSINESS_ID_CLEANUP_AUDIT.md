# Listing Business ID Cleanup Audit

## Summary

Strategy chosen: **Strategy A, transitional compatibility layer**.

The codebase still relies on `listings.business_id` as the business owner auth user id in too many production paths to safely convert it to `businesses.id` in one migration. This includes business-owner listing edits, public listing views, cart grouping, checkout, order creation, inventory jobs, media commits, admin moderation, seed scripts, and RLS policies.

The implemented compatibility layer adds `listings.business_entity_id` as the canonical nullable reference to `businesses.id`, backfills it from `businesses.owner_user_id = listings.business_id`, and keeps legacy paths working.

## Current Ownership Model

- Canonical business entity: `businesses.id`
- Business owner auth user: `businesses.owner_user_id`
- Legacy listing owner field: `listings.business_id`
- Transitional canonical listing field: `listings.business_entity_id`

During the transition:

- `listings.business_id` remains the legacy owner user id.
- `listings.business_entity_id` should be preferred for canonical business references.
- Database triggers populate `business_entity_id` when browser-created listing writes only provide `business_id`.
- Monetization listing-limit enforcement prefers `business_entity_id` and falls back to the legacy owner mapping.

## Database Dependencies

| Object | Path | Expected `listings.business_id` meaning | Facing | Sensitivity | Notes |
| --- | --- | --- | --- | --- | --- |
| `public.listings` | `supabase/migrations/20251205204210_init.sql` | Owner user id | shared | listing core | Initial schema created ambiguous `business_id uuid` without FK. |
| Listing RLS policies | `20251205204210_init.sql`, `20260214143000_listings_public_visibility_verified.sql` | Owner user id | public/business-owner | authorization | Insert/update/delete/read checks used `auth.uid() = business_id`; compatibility migration adds canonical OR fallback. |
| `public.public_listings_v` | `20260214143000...`, `20260423...`, `20260424...`, `20260425...`, `20260426...`, `20260428...`, `20260504...` | Owner user id | public/customer | public visibility | Historically joins `businesses b ON b.owner_user_id = l.business_id`; compatibility migration joins canonical first with legacy fallback and exposes `business_entity_id`. |
| `public.resolve_listing_ref` | `20260211123000_public_ids_and_refs.sql`, `20260424110000_align_resolve_listing_ref_staging.sql` | Not ownership-sensitive | public/customer/admin | public refs | Resolves by listing id/public id; no ownership migration needed. |
| Listing variant source functions | `20260424130000_add_listing_variants_phase_1.sql`, `20260424153000_fix_replace_listing_option_tree.sql` | Owner user id for manage checks | business-owner/customer | inventory/options | Manage checks use `auth.uid() = l.business_id`; future cleanup should add canonical owner checks. |
| Inventory reservation RPCs | `20260419120000_atomic_listing_inventory_reservations.sql`, `20260430110000_add_cart_reservations.sql` | Mostly listing id; sometimes reads listing row | cart/order/inventory | inventory critical | Inventory quantities are keyed by `listing_id`; vendor ownership is resolved elsewhere. |
| Media asset public policy | `20260509120000_add_media_assets_lifecycle.sql` | Owner user id | public/customer/media | media visibility | Compatibility migration updates listing media visibility join to canonical-first fallback. |
| Monetization listing limit trigger | `20260519170000_monetization_foundation.sql` | Owner user id fallback to `businesses.id` | business-owner/monetization | monetization enforcement | Compatibility migration replaces this with canonical-first behavior. |
| New compatibility migration | `20260519183000_listing_business_entity_compatibility.sql` | Both | shared | migration guardrail | Adds canonical field, backfill, indexes, trigger, RLS/view/policy updates. |

## Application Dependencies

| Area | Paths | Expected `listings.business_id` meaning | Facing | Sensitivity | Notes |
| --- | --- | --- | --- | --- | --- |
| Business listing list API | `app/api/business/listings/route.js` | Owner user id | business-owner | editing/auth | Filters `.eq("business_id", effectiveUserId)`. Kept for compatibility. |
| Business listing item API | `app/api/business/listings/[id]/route.js` | Owner user id | business-owner | editing/archive | GET/delete/archive filters by `effectiveUserId`. |
| Listing editor loader | `lib/business/getOwnedListingEditorData.js` | Owner user id | business-owner | editing | Loads listing by id/public id plus owner user id. |
| New listing page | `app/(business)/business/listings/new/page.jsx` | Owner user id | business-owner | creation/media/inventory | Browser insert writes `business_id: accountId`; DB trigger now fills `business_entity_id`. |
| Edit listing page | `app/(business)/business/listings/[id]/edit/page.js` | Owner user id | business-owner | editing/media/inventory | Updates with `.eq("business_id", accountId)`. |
| Business listing dashboard | `app/(business)/business/listings/page.js`, `lib/business/listingsCatalog.ts` | Owner user id | business-owner | listing management | Reads through business listing API; status update still relies on RLS. |
| Business preview/profile pages | `app/(business)/business/preview/page.js`, `app/(business)/business/profile/page.js` | Owner user id | business-owner/public preview | preview/profile | Listing queries filter by effective owner user id. |
| Public business profile | `app/(public)/(marketing)/b/[id]/page.jsx`, `components/publicBusinessProfile/*` | Owner user id for listing rows; canonical business profile id elsewhere | public/customer | public visibility | Public listing reads are through `public_listings_v`; business announcements/reviews/galleries use canonical business profile ids. |
| Public listing details | `lib/listings/publicListingDetails.js`, `app/api/customer/listings/route.js`, `app/(public)/listings/[id]/ListingDetailsClient.jsx` | Previously owner user id | public/customer | listing detail/cart handoff | Server detail now uses `getPublicBusinessForListing`, preferring `business_entity_id`. Client still carries `listing.business_id` as vendor/owner id for cart handoff. |
| Home/search/category listing reads | `lib/home/getHomeListings.server.js`, `app/api/home-listings/route.js`, `app/api/search/route.js`, `lib/categoryListingsCached.ts`, `app/(customer)/category/[slug]/page.js`, `app/(public)/categories/[slug]/page.tsx` | Owner user id | public/customer | public visibility | Use `public_listings_v`; currently group/enrich by owner user id. Safe because view remains compatible. |
| Cart | `app/api/cart/route.js`, `components/cart/CartProvider.jsx`, `lib/cart/groupCartItemsByBusiness.js`, `lib/cart/reservations.js`, `app/cart/CartPageClient.jsx` | Owner user id/vendor id | customer | cart/order sensitive | Carts use `vendor_id` as owner user id and load vendors from `users`. Do not change until cart/vendor model is migrated. |
| Checkout | `app/checkout/page.js`, `app/api/stripe/checkout/create-session/route.ts` | Owner user id/vendor id | customer | checkout/payment sensitive | Checkout groups by cart `vendor_id`, loads business by `owner_user_id`, and creates orders for owner-user vendor id. |
| Orders | `app/api/orders/route.js`, `app/api/business/orders/route.js`, `lib/orders/*`, `components/messages/OrderCard.tsx` | Owner user id/vendor id | customer/business-owner | order critical | Existing marketplace order model uses `business_id/vendor_id` as owner user id in several paths. |
| Inventory jobs | `app/api/inventory/sync/route.js`, `app/api/inventory/jobs/[jobId]/route.js`, `lib/inventory.js` | Owner user id | business-owner/inventory | inventory critical | Inventory job rows use business owner user id. |
| Media commits | `lib/images/mediaAssets.server.js`, `app/api/media/commit/route.js`, `app/api/media/temp-upload/route.js` | Owner user id for listing access | business-owner/media | media critical | Listing media access validates `listings.business_id = ownerUserId`; canonical migration does not change storage paths. |
| Admin listings | `lib/admin/listings.ts`, `app/admin/listings/*`, `app/admin/users/[id]/_components/AdminBusinessListingsTab.tsx` | Owner user id | admin | moderation/support | Admin enrichment maps listings to businesses by `owner_user_id`; UI already documents the legacy join. |
| Admin users/KPIs | `lib/admin/users.ts`, `lib/admin/dashboardKpis.ts` | Owner user id | admin | reporting | Admin metrics group listings by owner user id. |
| Admin moderation | `app/admin/moderation/page.tsx`, `app/api/admin/listings/*`, moderation SQL functions | Owner user id | admin | moderation | Listing moderation fetches business user by `listing.business_id`. |
| AI description | `app/api/ai/description/route.ts`, `app/api/business/ai-description-usage/route.ts` | Mixed: listing owner user id for listing lookup, canonical business id for monetization usage | business-owner/monetization | AI/usage | Access context exposes both `effectiveUserId` and canonical `businessId`; keep both distinct. |
| Stripe Connect | `lib/stripe/connect.ts`, `lib/stripe/status.ts`, `app/api/stripe/connect/*` | Canonical `businesses.id` for Stripe account table context; owner user id for owner lookup | business-owner/payment | payment sensitive | Not directly dependent on listing ownership, but checkout is. |

## Seeds And Tests

| Path | Expected `listings.business_id` meaning | Notes |
| --- | --- | --- |
| `scripts/seed-launch-preview-content.ts` | Owner user id | Inserts seeded listings with `business_id: owner.authUserId`. |
| `scripts/verify-staging-auth-alignment.mjs` | Owner user id | Staging probe inserts listing rows with business user id. |
| `tests/business-listing-drafts.unit.test.ts` | Owner user id | Tests listing API/editor semantics. |
| `tests/business-listing-preview.unit.test.ts` | Owner user id | Business preview assumptions. |
| `tests/business-dashboard-paid-orders.unit.test.ts` | Owner user id/vendor id | Dashboard/order listing rows. |
| `tests/cart-*.unit.test.ts`, `tests/listing-add-to-cart-auth.unit.test.ts` | Owner user id/vendor id | Cart grouping and checkout handoff. |
| `tests/inventory-migration.unit.test.ts`, `tests/cart-reservations-migration.unit.test.ts` | Listing id primarily | Inventory migration source guards. |
| `tests/media-assets-server.unit.test.ts` | Owner user id | Listing media access validates legacy owner id. |
| `tests/customer-listing-visibility.unit.test.ts`, `tests/public-business-profile-route.unit.test.tsx` | `public_listings_v` | Public reads stay on compatibility view. |
| `tests/listing-business-id-compatibility.unit.test.ts` | Both | New regression coverage for transitional migration and helpers. |

## Public/Customer-Facing Paths

- `public_listings_v`
- Home listings: `lib/home/getHomeListings.server.js`, `app/api/home-listings/route.js`
- Search/category listings: `app/api/search/route.js`, `lib/categoryListingsCached.ts`, category pages
- Public listing detail: `lib/listings/publicListingDetails.js`, `app/api/customer/listings/route.js`
- Public business profile listings: `app/(public)/(marketing)/b/[id]/page.jsx`, `components/publicBusinessProfile/*`
- Saved listings/businesses routes
- Cart and checkout pages/routes
- Listing media public select policy

## Business-Owner/Admin-Facing Paths

- Business listing CRUD and editor pages
- Business dashboard/listings/profile/preview pages
- Inventory sync/jobs
- Media commit/temp upload/discard flows
- AI description route and usage route
- Business order dashboard and messages
- Admin listings, user detail listing tab, moderation, KPIs

## Order/Cart/Inventory/Media-Sensitive Paths

- Cart: `app/api/cart/route.js`, `lib/cart/*`, `components/cart/*`
- Checkout/payment: `app/checkout/page.js`, `app/api/stripe/checkout/create-session/route.ts`
- Orders: `app/api/orders/route.js`, `lib/orders/*`, `app/api/business/orders/route.js`
- Inventory: `app/api/inventory/*`, inventory reservation migrations/RPCs
- Media: `lib/images/mediaAssets.server.js`, `media_assets_public_active_select`

These paths should not be converted until `vendor_id`/order business semantics are audited separately.

## Implemented Migration Approach

1. Add `listings.business_entity_id uuid null references businesses(id) on delete set null`.
2. Backfill from `businesses.owner_user_id = listings.business_id`.
3. Add indexes for canonical lookups and active listing limit counting.
4. Add trigger `set_listing_business_entity_id` for browser writes that still only send legacy `business_id`.
5. Replace monetization active listing limit trigger with canonical-first/legacy-fallback logic.
6. Update listing RLS policies to allow owner checks through either legacy `business_id` or canonical `business_entity_id`.
7. Update `public_listings_v` to join via canonical id first and expose `business_entity_id`.
8. Update listing media public policy to understand both ownership shapes.
9. Add server helper `getPublicBusinessForListing` for public listing detail routes.

## Remaining TODOs

- Update business-owner listing writes to send `business_entity_id` directly once the client has a reliable canonical business id in auth/profile state.
- Audit and migrate cart `vendor_id`, order `business_id`/vendor fields, conversations, and notification code before changing any customer transaction semantics.
- Update admin listing enrichment to prefer `business_entity_id` once all environments have the compatibility migration.
- Add deeper integration tests against a local Supabase database for RLS and trigger behavior.

## Future Final Cleanup

- Once all code paths use canonical business id, rename/remove the legacy field.
- Add/validate FK from `listings.business_id` or its replacement column to `businesses.id`.
- Remove legacy fallback from monetization trigger.
- Remove legacy owner-user joins from `public_listings_v`, media policies, admin enrichment, cart/order lookup, and seed scripts.
- Rename customer/vendor fields where they currently store owner user ids but are named as business ids.
