-- ============================================================================
-- 010_bugfixes_and_security_hardening.sql
--
-- Originally drafted as a shared-DB multi-tenant retrofit (tenants /
-- tenant_members / tenant_id / tenant-scoped RLS). That direction was
-- superseded: this project is now a self-hosted template where each
-- customer gets their own dedicated Supabase project, so per-row tenant
-- isolation is unnecessary -- infrastructure-level isolation (one Supabase
-- project per customer) replaces it.
--
-- What's left here are the two things worth keeping regardless of that
-- direction: confirmed pre-existing bugs and confirmed live security holes,
-- both found while auditing `main` across all three repos. These apply to
-- THIS project's database as-is; the equivalent fixes will also be baked
-- directly into the template's single-shot bootstrap schema.sql (see
-- packages/database once the monorepo template exists) so new customers
-- never inherit them in the first place.
--
-- Defensive (IF EXISTS / IF NOT EXISTS) throughout since live Supabase
-- access was unavailable when this was written -- verify against the real
-- project and apply on staging/a branch first.
-- ============================================================================


-- ─── 1. Fix bookings.status: add 'Arrived', fix CRITICAL_UNALLOCATED gap ────
-- Confirmed from git: evexecoperator's 008 trigger emits SMS text for an
-- 'Arrived' status that no known CHECK constraint permits, and the
-- attestation engine's own CRITICAL_UNALLOCATED value (added by
-- evexecdriverapp) has no transition-guard branch allowing entry into it.

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


-- ─── 2. Security: close anon write access on driver_locations ──────────────
-- Currently anon can read AND write (insert/update) any driver's GPS
-- position with no ownership check -- a live spoofing/fraud vector (fake
-- ETAs, fake proof of route). Scope writes to the driver's own row via
-- auth.uid(); keep read access broad for now since ETA display likely
-- depends on it being readable without a stricter auth model in place yet.

do $$ begin
  if to_regclass('public.driver_locations') is not null then
    execute 'drop policy if exists driver_locations_anon_insert on public.driver_locations';
    execute 'drop policy if exists driver_locations_anon_update on public.driver_locations';
    execute $p$create policy driver_locations_own_write on public.driver_locations for all
      using (driver_id = auth.uid())
      with check (driver_id = auth.uid())$p$;
  end if;
end $$;


-- ─── 3. Security: close anon insert on job_proofs ───────────────────────────
-- Currently anon can insert a "proof of job" photo/signature for any
-- booking_id with no ownership check.

do $$ begin
  if to_regclass('public.job_proofs') is not null then
    execute 'drop policy if exists job_proofs_anon_insert on public.job_proofs';
    execute $p$create policy job_proofs_authenticated_insert on public.job_proofs for insert
      to authenticated
      with check (true)$p$;
  end if;
end $$;
