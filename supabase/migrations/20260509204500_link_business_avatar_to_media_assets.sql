alter table public.businesses
  add column if not exists avatar_media_asset_id uuid null references public.media_assets(id) on delete set null;

create index if not exists businesses_avatar_media_asset_id_idx
  on public.businesses(avatar_media_asset_id);
