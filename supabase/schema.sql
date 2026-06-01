-- EV Exec Operator Dashboard — Supabase Schema
-- Run this in your Supabase SQL editor to initialise the database.

-- ─── Drivers ──────────────────────────────────────────────────────────────────
create table if not exists drivers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text,
  vehicle     text,
  plate       text,
  status      text not null default 'Available'
                check (status in ('Available', 'Available soon', 'En route', 'Passenger onboard', 'Off duty')),
  rating      numeric(2,1) default 5.0,
  created_at  timestamptz default now()
);

-- ─── Bookings ─────────────────────────────────────────────────────────────────
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  ref           text unique not null,       -- e.g. EVX-1042
  customer_name text not null,
  customer_phone text,
  customer_email text,
  flight        text,
  direction     text not null default 'Airport → Destination',
  airport       text,
  destination   text,
  pickup_time   timestamptz,
  driver_id     uuid references drivers(id) on delete set null,
  price         numeric(8,2),
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
  ref         text unique not null,         -- e.g. MC-001
  caller      text not null,
  notes       text,
  attempts    int default 1,
  resolved    boolean default false,
  created_at  timestamptz default now()
);

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

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table drivers      enable row level security;
alter table bookings     enable row level security;
alter table missed_calls enable row level security;

-- Allow all operations for authenticated users (operator auth — Phase 5)
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
