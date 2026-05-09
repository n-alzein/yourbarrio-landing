# Loading Behavior Audit

Date: 2026-05-08

## Highest-priority safe fixes

1. `/customer/nearby` now treats cached empty arrays as loaded data. Before this, `[]` from `sessionStorage` was equivalent to no cache, so a valid `0 businesses` result could show the full card skeleton again on warm navigation.
2. `/customer/saved` now waits for `hasLoaded` before showing empty states. Cached or server rows still render immediately, and refreshes use inline status instead of replacing content.
3. `/cart` and `/checkout` now keep existing cart content visible during background cart refreshes. True cold loads still show the existing skeleton/loading surface, and checkout submission is disabled while cart validation is refreshing.

## Route classes and findings

### Public marketplace/discovery pages

- `/` and `/customer/home`: server fetch through `getHomeBrowseData`, then `CustomerHomeClient` may refresh `/api/home-listings` after hydration if location differs or no server listings exist. It already preserves existing listings during refresh. Auth/profile gating exists for customer mode through `HomeGuard`; this is intentional.
- `/listings`: client fetches `/api/home-listings`; uses `sessionStorage` by location/query/category and keeps cached results visible with a `Refreshing` indicator when `displayKey` matches. Cold load skeleton is intentional.
- `/categories/[slug]`: server-rendered listings with route-level `loading.tsx` skeleton. No client refetch; empty arrays are rendered as final empty states.
- `/customer/nearby`: client fetches `/api/public-businesses`; had cached-empty bug fixed. Cold load skeleton remains when no cache has been established.
- Public business profile `/b/[id]`: server page with route `loading.jsx` profile skeleton. Existing tests indicate cached profile content stays visible during preview refreshes.

### Public business/listing detail pages

- `/listings/[id]`: client fetches listing data unless `initialListing` is supplied. Current server page does not pass initial listing data, so true cold loads show the detail skeleton. Optimizing this requires moving the listing query server-side.
- Business profile detail routes are mostly server-loaded and preserve route-level skeletons for real navigation cold loads.

### Customer account pages

- `/account/orders` and `/account/purchase-history`: server fetch only after `requireRole("customer")`; no client refetch loop. Empty states are final server results.
- `/customer/saved`: server initial props plus localStorage cache and client refresh. Empty-state-before-loaded bug fixed.
- `/customer/messages`: client fetch with module-level conversation/thread caches. Existing pattern correctly distinguishes initial loading from refreshing and shows `Updating...` when cached data exists.
- `/customer/settings`: auth/profile-gated form; loading is tied to auth/profile readiness and was left unchanged.

### Business account pages

- `/business/messages`: server initial conversations/thread plus module-level client cache in `BusinessMessagesInboxClient`; preserves cached content during refresh.
- `/business/listings`: sessionStorage cache and `hasLoaded` are already used to avoid warm skeletons.
- `/business/orders`: module-level tab cache pattern exists; shows skeleton only when no cached/visible orders are available.
- `/business/dashboard`: sessionStorage and module cache exist, with `loading` vs `refreshing` state. Larger optimization should be separate because Stripe/dashboard widgets are dynamically loaded and stateful.

### Admin pages

- Admin routes are mostly server-rendered tables/forms with client action islands. No broad loading rewrite was applied. Admin loading behavior should remain conservative because authorization and support-mode data scope matter.

### Auth/onboarding pages

- Auth and onboarding routes use form-level `loading`, route Suspense fallbacks, and auth session finalization states. These are intentional and were not changed.

### Cart/checkout

- `CartProvider` has global in-flight and short TTL caches. The page components were still replacing existing content with a full skeleton whenever `loading` was true. `/cart` and `/checkout` now render previous cart content while showing `Updating cart...` during background refresh.
- Inventory/reservation/payment validation semantics were not changed. Checkout submit is disabled while cart refresh is active.

## Deferred deeper work

- `/listings/[id]` should receive server-provided initial listing/business data to avoid detail-page skeletons on cold navigation.
- `/customer/nearby` could become server-assisted with initial public-business data keyed by location cookies, but that needs route/API coordination.
- Business dashboard could reduce dynamic widget placeholders further, but it needs a focused pass around Stripe status, dashboard API timing, and widget split points.
- Cart/checkout could be improved further with server-provided initial cart data, but validation and guest-to-auth handoff behavior need dedicated tests first.
