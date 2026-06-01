-- EV Exec Operator Dashboard — Supabase Schema
-- Run this in your Supabase SQL editor to initialise the database.
-- For existing deployments apply supabase/migrations/001_harden.sql instead.

-- ─── Drivers ──────────────────────────────────────────────────────────────────
create table if not exists drivers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  vehicle     text,
  plate       text,
  status      text not null default 'Available'
                check (status in ('Available', 'Available soon', 'En route', 'Passenger onboard', 'Off duty')),
  rating      numeric(2,1) default 5.0
                check (rating between 0.0 and 5.0),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null
                  check (ref ~ '^EVX-[A-Z0-9]+$'),
  customer_name text not null
                  check (char_length(customer_name) between 1 and 120),
  customer_phone text,
  customer_email text,
  flight        text,
  direction     text not null default 'Airport → Destination',
  airport       text,
  destination   text,
  pickup_time   timestamptz,
  driver_id     uuid references drivers(id) on delete set null,
  price         numeric(8,2)
                  check (price >= 0),
  status        text not null default 'Unassigned'
                  check (status in (
                    'Unassigned', 'Dispatched', 'En Route',
                    'Passenger On Board', 'Completed', 'Cancelled',
                    'Unassigned / Missed Call Recovery'
                  )),
  priority      boolean default false,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ─── Missed Calls ─────────────────────────────────────────────────────────────
create table if not exists missed_calls (
  id          uuid primary key default gen_random_uuid(),
  ref         text unique not null,
  caller      text not null,
  notes       text,
  attempts    int default 1
                check (attempts >= 0),
  resolved    boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index if not exists idx_bookings_ref         on bookings(ref);
create index if not exists idx_bookings_status      on bookings(status);
create index if not exists idx_bookings_pickup_time on bookings(pickup_time);
create index if not exists idx_bookings_driver_id   on bookings(driver_id);
create index if not exists idx_bookings_created_at  on bookings(created_at desc);
create index if not exists idx_missed_calls_resolved on missed_calls(resolved);
create index if not exists idx_missed_calls_ref      on missed_calls(ref);

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists bookings_updated_at on bookings;
create trigger bookings_updated_at
  before update on bookings
  for each row execute function update_updated_at();

drop trigger if exists drivers_updated_at on drivers;
create trigger drivers_updated_at
  before update on drivers
  for each row execute function update_updated_at();

drop trigger if exists missed_calls_updated_at on missed_calls;
create trigger missed_calls_updated_at
  before update on missed_calls
  for each row execute function update_updated_at();

-- ─── Status transition enforcement ───────────────────────────────────────────
-- Prevents invalid status retrograde/arbitrary transitions at the DB level.
-- This is the authoritative guard; the application layer also validates but
-- the trigger fires even when the DB is updated directly (Supabase Studio, etc).
create or replace function enforce_booking_status_transition()
returns trigger language plpgsql as $$
declare
  allowed text[];
begin
  if new.status = old.status then return new; end if;

  case old.status
    when 'Unassigned' then
      allowed := array['Dispatched', 'Cancelled', 'Unassigned / Missed Call Recovery'];
    when 'Unassigned / Missed Call Recovery' then
      allowed := array['Dispatched', 'Cancelled'];
    when 'Dispatched' then
      allowed := array['En Route', 'Cancelled'];
    when 'En Route' then
      allowed := array['Passenger On Board', 'Cancelled'];
    when 'Passenger On Board' then
      allowed := array['Completed', 'Cancelled'];
    when 'Completed' then
      allowed := array[]::text[];
    when 'Cancelled' then
      allowed := array[]::text[];
    else
      -- Unknown prior status — allow any valid status (graceful bootstrap)
      return new;
  end case;

  if not (new.status = any(allowed)) then
    raise exception 'Invalid status transition: % → %. Allowed: %',
      old.status, new.status, array_to_string(allowed, ', ');
  end if;

  return new;
end;
$$;

drop trigger if exists booking_status_transition on bookings;
create trigger booking_status_transition
  before update on bookings
  for each row
  when (old.status is distinct from new.status)
  execute function enforce_booking_status_transition();

-- ─── Driver double-booking prevention ────────────────────────────────────────
-- Prevents assigning a driver to a booking when they already have an active
-- booking within a ±3-hour window around the new pickup time.
-- Adjust the interval to match your typical transfer duration.
create or replace function prevent_driver_double_booking()
returns trigger language plpgsql as $$
declare
  conflict_count int;
begin
  if new.driver_id is null or new.pickup_time is null then return new; end if;
  if new.status in ('Completed', 'Cancelled') then return new; end if;

  select count(*) into conflict_count
  from bookings
  where driver_id   = new.driver_id
    and id         != new.id
    and status not in ('Completed', 'Cancelled')
    and pickup_time between (new.pickup_time - interval '3 hours')
                        and (new.pickup_time + interval '3 hours');

  if conflict_count > 0 then
    raise exception
      'Driver already has an active booking within 3 hours of this pickup time. '
      'Resolve or complete the existing booking before reassigning.';
  end if;

  return new;
end;
$$;

drop trigger if exists driver_double_booking on bookings;
create trigger driver_double_booking
  before insert or update on bookings
  for each row execute function prevent_driver_double_booking();

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table drivers      enable row level security;
alter table bookings     enable row level security;
alter table missed_calls enable row level security;

-- Operator auth will be implemented in Phase 5 (Supabase Auth + JWT roles).
-- Until then, anon key is scoped per-deployment and RLS permits all operations.
-- When Auth is added: replace `true` with `auth.uid() is not null`.
create policy "auth users full access" on drivers      for all using (true);
create policy "auth users full access" on bookings     for all using (true);
create policy "auth users full access" on missed_calls for all using (true);

-- ─── Seed data ────────────────────────────────────────────────────────────────
insert into drivers (name, phone, vehicle, plate, status, rating) values
  ('Nitisat Siri',  '+44 7700 900001', 'Tesla Model Y',    'EV21 NSR', 'Available soon',    4.9),
  ('Sarah Lane',    '+44 7700 900002', 'Tesla Model Y',    'EV21 SLN', 'En route',          4.8),
  ('Mark Ellison',  '+44 7700 900003', 'Mercedes EQE',     'EV22 MEL', 'Passenger onboard', 5.0),
  ('David King',    '+44 7700 900004', 'Tesla Model 3',    'EV23 DKG', 'Available',         4.7)
on conflict do nothing;

insert into missed_calls (ref, caller, notes, attempts) values
  ('MC-001', '+44 7700 900211', 'Possible airport transfer — left no voicemail', 2),
  ('MC-002', '+44 7700 900344', 'Callback scheduled via automation',             1),
  ('MC-003', '+44 7700 900512', 'Repeated caller — high priority',               3),
  ('MC-004', '+44 7700 900678', 'Website form submitted alongside call',         1)
on conflict do nothing;
