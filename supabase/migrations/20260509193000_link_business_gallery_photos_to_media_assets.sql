alter table public.business_gallery_photos
  add column if not exists media_asset_id uuid null references public.media_assets(id) on delete set null;

create index if not exists business_gallery_photos_media_asset_id_idx
  on public.business_gallery_photos(media_asset_id);
