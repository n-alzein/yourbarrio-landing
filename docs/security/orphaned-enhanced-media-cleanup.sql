-- Optional admin audit for legacy enhanced listing images.
-- This intentionally does not delete anything. Use it to list old objects under
-- listing-photos/enhanced/* that predate media_assets.enhanced_path tracking.
--
-- Storage objects are project-specific; run from Supabase SQL editor if the
-- storage.objects table is available to the admin role.

select
  bucket_id,
  name,
  created_at,
  updated_at
from storage.objects
where bucket_id = 'listing-photos'
  and name like 'enhanced/%'
order by created_at desc;
