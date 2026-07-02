-- ============================================================================
-- 010_multi_tenant_foundation.sql
--
-- Retrofits multi-tenancy onto the shared EV Exec database (evexecoperator,
-- evexecdriverapp, evexec all write to one Supabase project). Built from a
-- git-history audit of `main` on all three repos, cross-referenced for
-- consistency. Live Supabase MCP access was unavailable when this was
-- written, so every statement is defensive (IF EXISTS / IF NOT EXISTS) and
-- nothing here touches objects that only exist out-of-band:
--   - notification_log (queried by evexecoperator 007/008, created nowhere)
--   - functions notify_driver_new_booking(), driver_accept_booking(),
--     driver_update_status(), set_updated_at(), sync_assigned_driver_id()
--     (referenced/hardened by evexecdriverapp, defined nowhere in git)
--   - storage buckets (used for job/driver photos, no bucket DDL in any repo)
--   - drivers.is_online (indexed by evexecdriverapp, never ADD COLUMN'd)
-- Run get_advisors / list_tables against the live project before applying,
-- to confirm none of the above conflicts with what's actually there, and
-- apply on a Supabase branch/staging copy first -- this rewrites RLS on
-- tables with live production data.
-- ============================================================================


-- ─── 1. Tenants & membership ────────────────────────────────────────────────────────────

create table if not exists public.tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null check (slug ~ '^[a-z0-9-]+$'),
  name          text not null,
  status        text not null default 'active' check (status in ('active', 'suspended', 'trial')),
  branding      jsonb not null default '{}'::jsonb,  -- logo_url, primary_color, favicon_url, display_name
  contact_email text,
  contact_phone text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists public.tenant_members (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner', 'operator', 'driver')),
  created_at timestamptz default now(),
  unique (tenant_id, user_id)
);

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists tenants_service_role_all on public.tenants;
create policy tenants_service_role_all on public.tenants for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists tenants_read_own on public.tenants;
create policy tenants_read_own on public.tenants for select
  using (id = (select tm.tenant_id from public.tenant_members tm where tm.user_id = auth.uid() limit 1));

drop policy if exists tenant_members_service_role_all on public.tenant_members;
create policy tenant_members_service_role_all on public.tenant_members for all
  using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
drop policy if exists tenant_members_read_own on public.tenant_members;
create policy tenant_members_read_own on public.tenant_members for select
  using (user_id = auth.uid());


-- ─── 2. JWT claim injection + RLS helper ──────────────────────────────
-- Manual step outside SQL: register public.custom_access_token_hook in
-- Supabase Dashboard > Authentication > Hooks > Custom Access Token.
-- Without that registration, tenant_id never reaches issued JWTs and every
-- tenant-scoped policy below denies all authenticated access.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable
as $$
declare
  claims     jsonb := event->'claims';
  membership record;
begin
  select tm.tenant_id, tm.role into membership
  from public.tenant_members tm
  where tm.user_id = (event->>'user_id')::uuid
  limit 1;

  if membership.tenant_id is not null then
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(membership.tenant_id::text));
    claims := jsonb_set(claims, '{app_metadata,tenant_role}', to_jsonb(membership.role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

create or replace function public.current_tenant_id()
returns uuid
language sql stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid
$$;

grant execute on function public.current_tenant_id() to anon, authenticated;


-- ─── 3. Default tenant + tenant_id columns + backfill ───────────────────

insert into public.tenants (slug, name) values ('evexec', 'EV Exec')
on conflict (slug) do nothing;

do $$
declare
  default_tenant uuid := (select id from public.tenants where slug = 'evexec');
begin
  alter table public.bookings         add column if not exists tenant_id uuid references public.tenants(id);
  alter table public.drivers          add column if not exists tenant_id uuid references public.tenants(id);
  alter table public.missed_calls     add column if not exists tenant_id uuid references public.tenants(id);
  alter table public.quote_requests   add column if not exists tenant_id uuid references public.tenants(id);
  alter table public.contact_messages add column if not exists tenant_id uuid references public.tenants(id);
  alter table public.reviews          add column if not exists tenant_id uuid references public.tenants(id);

  if to_regclass('public.driver_locations') is not null then
    execute 'alter table public.driver_locations add column if not exists tenant_id uuid references public.tenants(id)';
    execute format('update public.driver_locations set tenant_id = %L where tenant_id is null', default_tenant);
  end if;

  if to_regclass('public.job_proofs') is not null then
    execute 'alter table public.job_proofs add column if not exists tenant_id uuid references public.tenants(id)';
    execute format('update public.job_proofs set tenant_id = %L where tenant_id is null', default_tenant);
  end if;

  update public.bookings         set tenant_id = default_tenant where tenant_id is null;
  update public.drivers          set tenant_id = default_tenant where tenant_id is null;
  update public.missed_calls     set tenant_id = default_tenant where tenant_id is null;
  update public.quote_requests   set tenant_id = default_tenant where tenant_id is null;
  update public.contact_messages set tenant_id = default_tenant where tenant_id is null;
  update public.reviews          set tenant_id = default_tenant where tenant_id is null;

  alter table public.bookings     alter column tenant_id set not null;
  alter table public.drivers      alter column tenant_id set not null;
  alter table public.missed_calls alter column tenant_id set not null;
end $$;

-- Backfill tenant_members for existing drivers (drivers.id == auth.users.id
-- by convention in the driver app, never FK-enforced; only link where a
-- matching auth.users row already exists).
insert into public.tenant_members (tenant_id, user_id, role)
select d.tenant_id, d.id, 'driver'
from public.drivers d
join auth.users u on u.id = d.id
on conflict (tenant_id, user_id) do nothing;

create index if not exists idx_bookings_tenant_id     on public.bookings(tenant_id);
create index if not exists idx_drivers_tenant_id      on public.drivers(tenant_id);
create index if not exists idx_missed_calls_tenant_id on public.missed_calls(tenant_id);


-- ─── 4. Fix bookings.status: add 'Arrived', fix CRITICAL_UNALLOCATED gap ────
-- Confirmed from git: evexecoperator's 008 trigger emits SMS text for an
-- 'Arrived' status that no known CHECK constraint permits, and the
-- attestation engine's own CRITICAL_UNALLOCATED value (added by
-- evexecdriverapp) has no transition-guard branch allowing entry into it.
-- Both are pre-existing bugs independent of multi-tenancy; fixing them here
-- since this migration already touches the same trigger/constraint.

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in (
    'Unassigned', 'Dispatched', 'En Route', 'Arrived', 'Passenger On Board',
    'Completed', 'Cancelled', 'Unassigned / Missed Call Recovery',
    'CRITICAL_UNALLOCATED'
  ));

create or replace function public.enforce_booking_status_transition()
returns trigger language plpgsql as $$
declare
  allowed text[];
begin
  if new.status = old.status then return new; end if;

  -- Any active (non-terminal) status can escalate to CRITICAL_UNALLOCATED --
  -- this is the attestation engine's panic path when a driver fails to
  -- confirm in time, and must always be reachable regardless of current status.
  if new.status = 'CRITICAL_UNALLOCATED'
     and old.status not in ('Completed', 'Cancelled') then
    return new;
  end if;

  case old.status
    when 'Unassigned' then
      allowed := array['Dispatched', 'Cancelled', 'Unassigned / Missed Call Recovery'];
    when 'Unassigned / Missed Call Recovery' then
      allowed := array['Dispatched', 'Cancelled'];
    when 'Dispatched' then
      allowed := array['En Route', 'Arrived', 'Cancelled'];
    when 'En Route' then
      allowed := array['Arrived', 'Passenger On Board', 'Cancelled'];
    when 'Arrived' then
      allowed := array['Passenger On Board', 'Cancelled'];
    when 'Passenger On Board' then
      allowed := array['Completed', 'Cancelled'];
    when 'CRITICAL_UNALLOCATED' then
      allowed := array['Dispatched', 'Cancelled'];
    when 'Completed' then
      allowed := array[]::text[];
    when 'Cancelled' then
      allowed := array[]::text[];
    else
      return new;
  end case;

  if not (new.status = any(allowed)) then
    raise exception 'Invalid status transition: % → %. Allowed: %',
      old.status, new.status, array_to_string(allowed, ', ');
  end if;

  return new;
end;
$$;


-- ─── 5. RLS rewrite: replace USING (true) with tenant scoping ───────────
-- service_role bypasses RLS by default; its existing ALL/true policies are
-- left untouched. Everything else below replaces a confirmed wide-open
-- policy from the audit (anon/authenticated USING(true), including the
-- legacy "auth users full access" policies still present from schema.sql
-- that predate the 002_rls_policies.sql cleanup and were never dropped).

-- bookings
drop policy if exists "auth users full access" on public.bookings;
drop policy if exists bookings_authenticated_all on public.bookings;
drop policy if exists bookings_anon_select on public.bookings;
drop policy if exists anon_insert_bookings on public.bookings;
create policy bookings_tenant_read on public.bookings for select
  using (tenant_id = public.current_tenant_id());
create policy bookings_tenant_write on public.bookings for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());
-- Public booking-form submissions (anon, no JWT tenant claim) must supply a
-- valid, active tenant_id explicitly rather than relying on a blanket true.
create policy bookings_public_insert on public.bookings for insert
  to anon
  with check (exists (select 1 from public.tenants t where t.id = bookings.tenant_id and t.status = 'active'));

-- drivers
drop policy if exists "auth users full access" on public.drivers;
drop policy if exists drivers_authenticated_all on public.drivers;
drop policy if exists drivers_anon_select on public.drivers;
drop policy if exists dashboard_anon_all_drivers on public.drivers;
drop policy if exists drivers_select_own on public.drivers;
drop policy if exists drivers_update_own on public.drivers;
create policy drivers_tenant_read on public.drivers for select
  using (tenant_id = public.current_tenant_id());
create policy drivers_tenant_write on public.drivers for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- missed_calls (internal operator data -- no anon access at all)
drop policy if exists "auth users full access" on public.missed_calls;
drop policy if exists missed_calls_authenticated_all on public.missed_calls;
drop policy if exists missed_calls_anon_select on public.missed_calls;
drop policy if exists dashboard_anon_all_missed_calls on public.missed_calls;
create policy missed_calls_tenant_all on public.missed_calls for all
  using (tenant_id = public.current_tenant_id())
  with check (tenant_id = public.current_tenant_id());

-- driver_locations: currently anon can read AND write (insert/update) any
-- driver's GPS position with no ownership check -- closing that here since
-- it's a live spoofing/fraud vector, not just a tenant-isolation gap.
do $$ begin
  if to_regclass('public.driver_locations') is not null then
    execute 'drop policy if exists driver_locations_service_bypass on public.driver_locations';
    execute 'drop policy if exists driver_locations_authenticated_all on public.driver_locations';
    execute 'drop policy if exists driver_locations_anon_select on public.driver_locations';
    execute 'drop policy if exists driver_locations_anon_insert on public.driver_locations';
    execute 'drop policy if exists driver_locations_anon_update on public.driver_locations';
    execute $p$create policy driver_locations_service_bypass on public.driver_locations for all
      using (auth.role() = 'service_role') with check (auth.role() = 'service_role')$p$;
    execute $p$create policy driver_locations_tenant_read on public.driver_locations for select
      using (tenant_id = public.current_tenant_id())$p$;
    execute $p$create policy driver_locations_own_write on public.driver_locations for all
      using (driver_id = auth.uid() and tenant_id = public.current_tenant_id())
      with check (driver_id = auth.uid() and tenant_id = public.current_tenant_id())$p$;
  end if;
end $$;

-- job_proofs: currently anon can insert a "proof of job" photo/signature for
-- any booking_id with no ownership check -- same class of issue as above.
do $$ begin
  if to_regclass('public.job_proofs') is not null then
    execute 'drop policy if exists job_proofs_service_bypass on public.job_proofs';
    execute 'drop policy if exists job_proofs_authenticated_all on public.job_proofs';
    execute 'drop policy if exists job_proofs_anon_select on public.job_proofs';
    execute 'drop policy if exists job_proofs_anon_insert on public.job_proofs';
    execute $p$create policy job_proofs_service_bypass on public.job_proofs for all
      using (auth.role() = 'service_role') with check (auth.role() = 'service_role')$p$;
    execute $p$create policy job_proofs_tenant_scope on public.job_proofs for all
      using (exists (
        select 1 from public.bookings b
        where b.id = job_proofs.booking_id and b.tenant_id = public.current_tenant_id()
      ))
      with check (exists (
        select 1 from public.bookings b
        where b.id = job_proofs.booking_id and b.tenant_id = public.current_tenant_id()
      ))$p$;
  end if;
end $$;

-- quote_requests / contact_messages: public-form anon INSERT, scoped to a
-- valid active tenant; reads restricted to that tenant's members.
create policy quote_requests_tenant_read on public.quote_requests for select
  using (tenant_id = public.current_tenant_id());
create policy quote_requests_public_insert on public.quote_requests for insert
  to anon
  with check (exists (select 1 from public.tenants t where t.id = quote_requests.tenant_id and t.status = 'active'));

drop policy if exists anon_insert on public.contact_messages;
create policy contact_messages_tenant_read on public.contact_messages for select
  using (tenant_id = public.current_tenant_id());
create policy contact_messages_public_insert on public.contact_messages for insert
  to anon
  with check (exists (select 1 from public.tenants t where t.id = contact_messages.tenant_id and t.status = 'active'));

-- reviews: public read (they're testimonials), tenant-scoped write
create policy reviews_public_read on public.reviews for select
  using (true);
create policy reviews_tenant_write on public.reviews for insert
  with check (tenant_id = public.current_tenant_id());

-- Storage buckets are NOT touched here -- no bucket DDL exists in any of the
-- three repos' git history, so their real policies are unknown. Verify
-- live (get_advisors / storage.objects policies) before scoping them.
