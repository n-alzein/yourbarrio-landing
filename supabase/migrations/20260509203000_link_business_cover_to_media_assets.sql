alter table public.businesses
  add column if not exists cover_media_asset_id uuid null references public.media_assets(id) on delete set null;

create index if not exists businesses_cover_media_asset_id_idx
  on public.businesses(cover_media_asset_id);
