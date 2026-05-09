alter table public.media_assets
  add column if not exists enhanced_path text null;
