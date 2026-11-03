-- Compatibility migration for projects that applied the initial schema when the
-- public creative bucket was named public-assets. Existing objects are left in
-- place so no deployed asset URLs are broken.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'startup-assets',
  'startup-assets',
  true,
  5000000,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins manage startup assets" on storage.objects;
create policy "admins manage startup assets"
on storage.objects
for all
to authenticated
using (bucket_id = 'startup-assets' and (select public.is_admin()))
with check (bucket_id = 'startup-assets' and (select public.is_admin()));
