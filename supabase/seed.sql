-- DEVELOPMENT ONLY: clearly fictional records for local UI testing. Never run in production.
insert into public.startups (name,slug,description,website,industry,address,neighbourhood,latitude,longitude,location_verified,verified,source_url)
values ('Sample Orbit Labs','sample-orbit-labs','Fictional development-only company used to verify maps and directory layouts.','https://example.com','Developer Tools','Development seed address','Koramangala',12.9352,77.6245,true,true,'https://example.com')
on conflict (slug) do nothing;
