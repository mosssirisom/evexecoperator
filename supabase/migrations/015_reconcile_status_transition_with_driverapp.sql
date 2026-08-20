-- ─── Reconcile status transition/constraint with evexecdriverapp's fixes ───
-- evexecoperator and evexecdriverapp both write migrations against the SAME
-- shared Supabase project with no cross-repo coordination. This repo's
-- 010_bugfixes_and_security_hardening.sql redefined bookings_status_check
-- and enforce_booking_status_transition() without knowing evexecdriverapp
-- had ALREADY independently fixed the same objects
-- (20260624100000_fix_booking_status_transition_trigger.sql and
-- 20260624110000_fix_bookings_status_check_constraint.sql). The two
-- versions diverged. This migration is the reconciled, definitive merge:
--
-- - bookings_status_check: restores the WIDER constraint (keeps the dead
--   legacy lowercase values -- pending/accepted/confirmed/rejected/
--   cancelled/en_route/arrived/active/'No Show'/completed -- alongside the
--   canonical Title-Case ones) instead of 010's narrower canonical-only
--   version. Application code no longer writes these legacy values
--   (confirmed via full source audit), but nothing proves no existing row
--   still carries one, and this migration can't check live data -- the
--   safe default is to keep accepting them rather than risk rejecting an
--   update to an old row.
-- - enforce_booking_status_transition(): restores the
--   'Passenger On Board' -> 'Arrived' "undo" path (used by the driver
--   app's 5-second undo button after swiping to Passenger On Board) that
--   010 accidentally dropped, while keeping 010's CRITICAL_UNALLOCATED
--   escalation handling, which neither repo's version of this function
--   has had until now.

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in (
    'pending', 'accepted', 'confirmed', 'Dispatched', 'rejected',
    'cancelled', 'Cancelled', 'en_route', 'En Route', 'arrived', 'Arrived',
    'active', 'Active', 'Passenger On Board', 'No Show', 'completed',
    'Completed', 'Unassigned', 'Unassigned / Missed Call Recovery',
    'CRITICAL_UNALLOCATED'
  ));

create or replace function public.enforce_booking_status_transition()
returns trigger language plpgsql as $$
declare
  allowed text[];
begin
  if new.status = old.status then return new; end if;

  -- Any active (non-terminal) status can escalate to CRITICAL_UNALLOCATED --
  -- the attestation engine's panic path when a driver fails to confirm in
  -- time -- and must always be reachable regardless of current status.
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
      allowed := array['En Route', 'Cancelled'];
    when 'En Route' then
      allowed := array['Arrived', 'Passenger On Board', 'Cancelled'];
    when 'Arrived' then
      allowed := array['Passenger On Board', 'Cancelled'];
    when 'Passenger On Board' then
      allowed := array['Completed', 'Arrived', 'Cancelled'];
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
