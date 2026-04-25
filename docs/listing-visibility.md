# Listing Visibility Rules

Use this rule whenever code reads listing data.

## Surfaces

- `public.listings` is the base table.
  It can contain drafts, hidden listings, and rows that are only valid for business-owner or admin workflows.
- `public.public_listings_v` is the public-safe listing surface.
  All public/customer-facing listing reads must use this view.

## Allowed Direct Reads From `public.listings`

- Business-owner flows may read `public.listings` directly when the query is scoped to the owning business.
- Admin flows may read `public.listings` directly when moderation, hidden-state, or status context is required.

## Rule

New public or customer-facing surfaces must not query `.from("listings")` unless the code can prove the request is owner-only or admin-only.

## Do / Don't

Do:

```ts
supabase.from("public_listings_v")
```

Don't:

```ts
supabase.from("listings")
```

from a public page, customer page, guest API route, or shared client component that can run in a public/customer context.
