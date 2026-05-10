# Media Pipeline Summary

Short reference for the current `media_assets` upload pipeline. Keep future media changes scoped so they do not duplicate this system or regress legacy fallbacks.

## Core Lifecycle

- Client uploads call `uploadTemporaryImage()` in `lib/images/tempMediaClient.js`.
- `/api/media/temp-upload` stores the original object under `business-photos/tmp/{user}/{session}/{asset}/source` and inserts `media_assets.status = "temporary"` with `expires_at`.
- Client save calls `commitTemporaryImages()`.
- `/api/media/commit` calls `commitTemporaryMediaAssets()` in `lib/images/mediaAssets.server.js`.
- Commit validates ownership, downloads the temporary source or enhanced temp source, generates variants, writes permanent paths under an asset-id path, updates the row to `status = "active"`, clears `expires_at`, and removes temporary source/enhanced objects.
- Permanent paths are unique per `media_assets.id`; do not overwrite prior active objects.

## Listing Images

- New listing: `app/(business)/business/listings/new/page.jsx`.
- Edit listing: `app/(business)/business/listings/[id]/edit/page.js`.
- Purpose is `listing_image`.
- Temp uploads stay as local draft photos until listing save.
- Commit requires an existing `listingId`; new listings insert the listing first, then commit pending photos and update listing media payload.
- Listing media is persisted in legacy listing photo fields plus `photo_variants` entries with `media_asset_id`.
- Remove/discard flows call `discardTemporaryImages()` for uncommitted temp asset ids.

## Listing Cover Selection

- Listing cover is selection metadata, not a separate upload pipeline.
- `cover_image_id` points at the selected listing photo/draft/media id.
- Cover resolution uses the selected listing photo variant when possible and falls back through existing listing image fields.
- Do not introduce separate listing-cover media behavior unless explicitly required.

## Business Gallery

- Upload helper: `lib/images/businessGalleryClient.js`.
- Purpose is `business_gallery`.
- Commit returns optimized gallery variants.
- Gallery row is inserted into `business_gallery_photos` with `media_asset_id` when the column exists, with legacy fallback if not.
- Render/query helpers use `business_gallery_photos.media_asset:media_assets(...)` when available and fall back to `photo_url`.

## Business Cover

- Upload path: `components/business/profile/BusinessProfilePage.jsx`.
- Purpose is `business_cover`.
- Commit returns `profileUrl` from cover variants.
- Saves `businesses.cover_photo_url` and, when available, `businesses.cover_media_asset_id`.
- Reads prefer `business_cover_media_asset` variants, then legacy cover URL fields.

## Business Avatar

- Upload paths:
  - `app/(business)/business/settings/page.js`
  - `components/business/profile/BusinessProfilePage.jsx`
- Purpose is `business_avatar`.
- Commit returns `profileUrl` from avatar variants and the committed media asset.
- Saves `businesses.profile_photo_url`, `businesses.avatar_media_asset_id`, and preserves the existing `users.profile_photo_url` write.
- Auth/profile state is patched after save so settings, editor, navbar, and mounted nearby/card views update without a full page reload.
- Resolver preference is linked `business_avatar_media_asset` variants, especially `avatar_512_path`, then `avatar_256_path`, then `avatar_128_path`, then legacy avatar fields.
- Business surfaces must not prefer `purpose = "user_avatar"` media assets.

## Cleanup Behavior

- Explicit discard API: `/api/media/discard-temp`.
- Server helper: `discardTemporaryMediaAssets()` only targets rows owned by the user with `status = "temporary"`.
- Cleanup removes all known storage paths from the row, including source, enhanced, listing, cover, gallery, and avatar variant fields, then marks rows `deleted`.
- Cron route: `/api/cron/cleanup-temp-media` cleans expired `status = "temporary"` rows only.
- Commit failure removes temporary source/enhanced objects and marks the row `failed`.
- Cleanup must never query by active/reference fields alone; it must keep `status = "temporary"` as the guard so active listing/gallery/cover/avatar/order history media is not deleted.

## Legacy Fallbacks

- Existing listing image fields and `photo_variants` still render without media asset rows.
- Business gallery falls back to `business_gallery_photos.photo_url`.
- Business cover falls back to legacy cover URL fields.
- Business avatar falls back to `avatar_url`, `logo_url`, `profile_photo_url`, then generated initials/placeholder.
- Customer/user avatars and OAuth/Google avatar fallback are separate from business avatar media linkage.

## Important Tests

- Media lifecycle routes: `tests/media-assets.unit.test.ts`.
- Server lifecycle helpers and cleanup paths: `tests/media-assets-server.unit.test.ts`.
- RLS/hardening expectations: `tests/media-assets-hardening.unit.test.ts`.
- Listing upload/save/discard behavior: `tests/new-listing.unit.test.tsx`, `tests/edit-listing-save.unit.test.ts`.
- Business gallery media resolution: `tests/business-gallery-media-assets.unit.test.ts`.
- Business avatar/cover resolver behavior: `tests/business-images.unit.test.ts`, `tests/media-asset-url-resolver.unit.test.ts`.
- Business profile upload behavior: `tests/business-profile-page.unit.test.tsx`.
- Public business/profile read paths: `tests/public-business-lookup.unit.test.ts`, `tests/business-profile-view.unit.test.tsx`.
- Avatar variant generation quality: `tests/image-variants.unit.test.ts`.
