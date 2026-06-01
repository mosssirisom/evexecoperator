-- Migration 001: Backend hardening
-- Apply to existing deployments that already ran schema.sql.
-- Safe to re-run (all operations are idempotent).

-- ─── Indexes ──────────────────────────────────────────────────────────────────
create index concurrently if not exists idx_bookings_ref          on bookings(ref);
create index concurrently if not exists idx_bookings_status       on bookings(status);
create index concurrently if not exists idx_bookings_pickup_time  on bookings(pickup_time);
create index concurrently if not exists idx_bookings_driver_id    on bookings(driver_id);
create index concurrently if not exists idx_bookings_created_at   on bookings(created_at desc);
create index concurrently if not exists idx_missed_calls_resolved on missed_calls(resolved);
create index concurrently if not exists idx_missed_calls_ref      on missed_calls(ref);

-- ─── Check constraints (idempotent via exception handling) ───────────────────
do $$ begin
  alter table bookings add constraint chk_bookings_price_nonneg
    check (price >= 0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table bookings add constraint chk_bookings_customer_len
    check (char_length(customer_name) between 1 and 120);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table bookings add constraint chk_bookings_ref_format
    check (ref ~ '^EVX-[A-Z0-9]+$');
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table drivers add constraint chk_drivers_rating_range
    check (rating between 0.0 and 5.0);
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table missed_calls add constraint chk_missed_calls_attempts_nn
    check (attempts >= 0);
exception when duplicate_object then null;
end $$;

-- ─── updated_at columns and triggers for drivers and missed_calls ─────────────
alter table drivers      add column if not exists updated_at timestamptz default now();
alter table missed_calls add column if not exists updated_at timestamptz default now();

-- update_updated_at() function already exists from base schema; create triggers
drop trigger if exists drivers_updated_at on drivers;
create trigger drivers_updated_at
  before update on drivers
  for each row execute function update_updated_at();

drop trigger if exists missed_calls_updated_at on missed_calls;
create trigger missed_calls_updated_at
  before update on missed_calls
  for each row execute function update_updated_at();

-- ─── Status transition enforcement trigger ───────────────────────────────────
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

-- ─── Driver double-booking prevention trigger ─────────────────────────────────
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
