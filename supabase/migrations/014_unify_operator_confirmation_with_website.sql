-- ─── Unify operator-booking confirmation with the website flow ────────────
-- Operator-created bookings now get the SAME confirmation website bookings
-- get once payment is chosen: SMS + email + push via sendConfirmations(),
-- triggered by a new app-level call from evexecoperator's createBooking()
-- to evexec's /api/notifications/confirm (see that repo's commit adding
-- it, and this repo's src/app/api/notify-confirmation/route.ts). This SQL
-- trigger no longer needs to send its own SMS-only "is booked" text.
--
-- Also drops the operator-only 24h reminder enqueue: the website's daily
-- reminder cron (evexec's api/reminders/trigger.js) already covers EVERY
-- booking by travel_date + status='Dispatched', with no source filter.
-- Keeping both meant an operator-booking customer could get the 24h
-- reminder SMS twice — once from this trigger (scheduled at pickup-24h)
-- and once from the shared cron's daily 8am sweep — whenever their
-- travel_date landed on the cron's "tomorrow" check.
--
-- Status-change texts (Dispatched/En Route/Arrived/Passenger On Board/
-- Completed/Cancelled) are UNCHANGED and still SMS-only — kept
-- deliberately as an operator-booking bonus feature the website flow has
-- no real equivalent for (confirmed with the business owner).
--
-- The trigger itself is now scoped to UPDATE OF status only; there is
-- nothing left for it to do on INSERT.

create or replace function public.enqueue_operator_customer_notifications()
returns trigger
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  v_phone text := nullif(trim(new.customer_phone), '');
  v_msg   text;
begin
  if coalesce(new.source, 'website') <> 'operator' then return new; end if;
  if v_phone is null then return new; end if;

  if new.status is distinct from old.status then
    v_msg := case new.status
      when 'Dispatched'         then 'EV Exec: a driver has been assigned to your transfer. Ref ' || new.ref || '.'
      when 'En Route'           then 'EV Exec: your driver is on the way. Ref ' || new.ref || '.'
      when 'Arrived'            then 'EV Exec: your driver has arrived at the pickup point. Ref ' || new.ref || '.'
      when 'Passenger On Board' then 'EV Exec: you are now on board — enjoy your journey. Ref ' || new.ref || '.'
      when 'Completed'          then 'EV Exec: thank you for travelling with us. Ref ' || new.ref || '.'
      when 'Cancelled'          then 'EV Exec: your booking ' || new.ref || ' has been cancelled. Please contact us if this is unexpected.'
      else null
    end;

    if new.status = 'Cancelled' and old.status = 'Completed' then
      v_msg := null;
    end if;

    if v_msg is not null then
      insert into notification_queue (id, booking_id, type, channel, recipient, body, status, attempts, next_attempt_at, created_at)
      values (gen_random_uuid(), new.id, 'status_update', 'sms', v_phone, v_msg, 'pending', 0, now(), now());
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_enqueue_operator_customer_notifications on public.bookings;
create trigger trg_enqueue_operator_customer_notifications
  after update of status on public.bookings
  for each row execute function public.enqueue_operator_customer_notifications();
