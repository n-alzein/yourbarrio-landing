alter table public.media_assets
  add column if not exists avatar_512_path text null;
