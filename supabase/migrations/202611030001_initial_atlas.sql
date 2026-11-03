-- Bangalore Startup Atlas initial schema. Apply with the Supabase CLI.
create extension if not exists pgcrypto;

create table public.startups (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'), description text check (char_length(description) <= 2000),
  website text, logo_url text, industry text not null, address text, neighbourhood text,
  latitude double precision check (latitude between -90 and 90), longitude double precision check (longitude between -180 and 180),
  location_verified boolean not null default false, verified boolean not null default false, source_url text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint coordinates_together check ((latitude is null) = (longitude is null)),
  constraint verified_location_has_coordinates check (not location_verified or (latitude is not null and longitude is not null))
);
create table public.startup_submissions (
  id uuid primary key default gen_random_uuid(), name text not null, website text not null unique, description text not null,
  industry text not null, address text not null, neighbourhood text not null, contact_email text not null, logo_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null, reviewed_at timestamptz, created_at timestamptz not null default now()
);
create table public.advertisement_requests (
  id uuid primary key default gen_random_uuid(), company_name text not null, company_website text not null, company_email text not null,
  contact_name text not null, contact_phone text not null, description text not null, industry text not null,
  package_type text not null check (package_type in ('flash','weekly')), amount integer not null check (amount > 0),
  transaction_reference text not null, payment_screenshot_url text not null, logo_url text, promotional_image_url text,
  payment_status text not null default 'pending_verification' check (payment_status in ('pending_verification','payment_verified','rejected','needs_information')),
  verification_notes text, created_at timestamptz not null default now()
);
create table public.advertisement_slots (
  id uuid primary key default gen_random_uuid(), slot_number integer not null unique check (slot_number between 1 and 4),
  slot_name text not null, is_enabled boolean not null default true, created_at timestamptz not null default now()
);
create table public.advertisements (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.advertisement_requests(id) on delete restrict,
  startup_id uuid references public.startups(id) on delete set null, slot_id uuid not null references public.advertisement_slots(id) on delete restrict,
  title text not null, description text not null, image_url text, website_url text not null,
  starts_at timestamptz not null, expires_at timestamptz not null, status text not null check (status in ('active','paused','removed','replaced')),
  created_at timestamptz not null default now(), constraint advertisement_dates_valid check (expires_at > starts_at)
);
create table public.pending_scraped_startups (
  id uuid primary key default gen_random_uuid(), name text not null, website text, description text, industry text, address text,
  neighbourhood text, latitude double precision check (latitude between -90 and 90), longitude double precision check (longitude between -180 and 180),
  location_verified boolean not null default false, logo_url text, source_url text not null, review_status text not null default 'pending' check (review_status in ('pending','approved','rejected')),
  collected_at timestamptz not null default now(), created_at timestamptz not null default now(),
  constraint scraped_coordinates_together check ((latitude is null) = (longitude is null))
);
create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(), admin_id uuid references auth.users(id) on delete set null,
  action text not null, entity_type text not null, entity_id uuid, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);

create index startups_public_directory_idx on public.startups (industry, neighbourhood, name) where verified;
create index startups_viewport_idx on public.startups (longitude, latitude) where verified and location_verified;
create index advertisement_active_window_idx on public.advertisements (starts_at, expires_at) where status = 'active';
create index advertisement_request_status_idx on public.advertisement_requests (payment_status, created_at desc);
create index startup_submission_status_idx on public.startup_submissions (status, created_at);
create index scraped_review_status_idx on public.pending_scraped_startups (review_status, created_at);
create index audit_entity_idx on public.admin_audit_logs (entity_type, entity_id, created_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger startups_touch_updated_at before update on public.startups for each row execute function public.touch_updated_at();

create or replace function public.is_admin() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.startups enable row level security;
alter table public.startup_submissions enable row level security;
alter table public.advertisement_requests enable row level security;
alter table public.advertisement_slots enable row level security;
alter table public.advertisements enable row level security;
alter table public.pending_scraped_startups enable row level security;
alter table public.admin_audit_logs enable row level security;

create policy "public reads verified startups" on public.startups for select to anon, authenticated using (verified or (select public.is_admin()));
create policy "admins insert startups" on public.startups for insert to authenticated with check ((select public.is_admin()));
create policy "admins update startups" on public.startups for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete startups" on public.startups for delete to authenticated using ((select public.is_admin()));
create policy "admins manage startup submissions" on public.startup_submissions for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins manage ad requests" on public.advertisement_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "public reads enabled slots" on public.advertisement_slots for select to anon, authenticated using (is_enabled or (select public.is_admin()));
create policy "admins manage slots" on public.advertisement_slots for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "public reads active ads" on public.advertisements for select to anon, authenticated using ((status = 'active' and starts_at <= now() and expires_at > now()) or (select public.is_admin()));
create policy "admins insert ads" on public.advertisements for insert to authenticated with check ((select public.is_admin()));
create policy "admins update ads" on public.advertisements for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins delete ads" on public.advertisements for delete to authenticated using ((select public.is_admin()));
create policy "admins manage scraped queue" on public.pending_scraped_startups for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admins read audit logs" on public.admin_audit_logs for select to authenticated using ((select public.is_admin()));
create policy "admins insert audit logs" on public.admin_audit_logs for insert to authenticated with check ((select public.is_admin()));

grant usage on schema public to anon, authenticated;
grant select on public.startups, public.advertisements, public.advertisement_slots to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into public.advertisement_slots (slot_number, slot_name) values (1,'North'),(2,'East'),(3,'South'),(4,'West') on conflict (slot_number) do nothing;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values
  ('startup-assets','startup-assets',true,5000000,array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('payment-proofs','payment-proofs',false,5000000,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "admins manage startup assets" on storage.objects for all to authenticated using (bucket_id='startup-assets' and (select public.is_admin())) with check (bucket_id='startup-assets' and (select public.is_admin()));
create policy "admins manage private proofs" on storage.objects for all to authenticated using (bucket_id='payment-proofs' and (select public.is_admin())) with check (bucket_id='payment-proofs' and (select public.is_admin()));
