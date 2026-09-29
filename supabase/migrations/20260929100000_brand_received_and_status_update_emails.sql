begin;

-- The 'received' (booking confirmation) and 'status_update' (En Route /
-- Arrived / Cancelled) email branches of enqueue_operator_customer_notifications()
-- were still sending a bare "<p>sentence</p>" -- the one remaining unbranded
-- customer email left in the system after 035_branded_reminder_and_job_emails.sql
-- already brought reminder_24h and the driver-facing emails onto the shared
-- evexec_notification_email() shell (navy header, gold rule, white card,
-- navy footer -- the same brand as evexec.co.uk itself). Consolidating onto
-- the same helper here closes that gap; the plain-text body used for SMS/
-- two-tap handoff is unchanged.

create or replace function public.enqueue_operator_customer_notifications()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_phone   text := nullif(trim(new.customer_phone), '');
  v_email   text := nullif(trim(new.customer_email), '');
  v_name    text := coalesce(nullif(trim(new.customer_name), ''), 'there');
  v_time5   text := substring(coalesce(new.travel_time,'') from 1 for 5);
  v_ukdate  text := case when new.travel_date is not null then to_char(new.travel_date,'DD/MM/YYYY') else null end;
  v_timetxt text := nullif(btrim(coalesce(v_time5,'') || ' ' || coalesce(v_ukdate,'')), '');
  v_status  text := lower(coalesce(new.payment_status, ''));
  v_did     uuid := coalesce(new.assigned_driver_id, new.driver_id);
  v_croute  text;
  v_msg     text; v_conf text; v_ch text; v_conf_html text; v_msg_html text;
  v_pill text; v_pill_bg text; v_pill_fg text; v_lead text; v_footnote text;
  v_is_operator boolean := coalesce(new.source, 'website') = 'operator';
  v_reminder_type text;
begin
  if v_phone is null and v_email is null then return new; end if;

  v_ch := case when v_email is not null then 'email'
               when v_phone is not null then 'sms'
               else null end;

  v_croute := case
    when nullif(new.pickup_location,'') is not null and nullif(new.dropoff_address,'') is not null
      then new.pickup_location || ' → ' || new.dropoff_address
    when new.direction='Destination → Airport'
      then coalesce(nullif(new.dropoff_address,''),nullif(new.pickup_location,''),'Pickup') || ' → ' || coalesce(nullif(new.airport,''),'Airport')
    else coalesce(nullif(new.airport,''),'Airport') || ' → ' || coalesce(nullif(new.dropoff_address,''),nullif(new.pickup_location,''),'Destination')
  end;

  if tg_op = 'INSERT' then
    if v_is_operator and v_ch is not null then
      v_conf := 'EV Exec: Hi ' || v_name || ', your airport transfer' || coalesce(' (' || v_timetxt || ')','') || ' is booked. Ref ' || new.ref || '.';
      v_conf_html := evexec_notification_email(
        'Booking confirmed', '#dcfce7', '#15803d',
        'Hi ' || evexec_esc(v_name) || ', your airport transfer is booked and confirmed.',
        jsonb_build_array(
          jsonb_build_object('label','Reference','value', new.ref),
          jsonb_build_object('label','When',     'value', v_timetxt),
          jsonb_build_object('label','Journey',  'value', v_croute)
        ),
        'We''ll be in touch with your driver details closer to the time. If anything changes, just reply to this email or call us.'
      );

      if not exists (select 1 from notification_queue q where q.booking_id=new.id and q.type='received')
         and not exists (select 1 from notification_log   l where l.booking_id=new.id and l.type='received')
         and not exists (select 1 from operator_sms_tasks  t where t.booking_id=new.id and t.kind='confirmation') then
        if v_ch='email' then
          insert into notification_queue (id,booking_id,type,channel,recipient,subject,body,html,status,attempts,next_attempt_at,created_at)
          values (gen_random_uuid(),new.id,'received','email',v_email,'Your EV Exec airport transfer is booked (Ref '||new.ref||')',v_conf,v_conf_html,'pending',0,now(),now());
        else
          -- Two-tap automation: no driver is normally assigned yet at
          -- booking creation, so this always hands off to staff.
          insert into public.operator_sms_tasks (booking_id, kind, customer_name, customer_phone, message, status)
          values (new.id, 'confirmation', v_name, v_phone, v_conf, 'pending')
          on conflict (booking_id, kind) do nothing;
        end if;
      end if;
    end if;
    -- reminder_24h / 7day is no longer created here -- evexec's own reminder
    -- cron (api/reminders/trigger.js) is the single owner for every booking
    -- regardless of source. See 20260923143619_consolidate_reminders_and_convert_received_sms.sql.

  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status then
      if new.status='En Route' and old.status='Dispatched' then
        v_msg := 'EV Exec: your driver is on the way. Ref '||new.ref||'.';
        v_reminder_type := 'en_route';
        v_pill := 'Driver on the way'; v_pill_bg := '#e6effb'; v_pill_fg := '#1e4a8a';
        v_lead := 'Hi ' || evexec_esc(v_name) || ', your driver is on the way.';
        v_footnote := null;
      elsif new.status='Arrived' and old.status='En Route' then
        v_msg := 'EV Exec: your driver has arrived at the pickup point. Ref '||new.ref||'.';
        v_reminder_type := 'arrived';
        v_pill := 'Driver has arrived'; v_pill_bg := '#e6effb'; v_pill_fg := '#1e4a8a';
        v_lead := 'Hi ' || evexec_esc(v_name) || ', your driver has arrived at the pickup point.';
        v_footnote := null;
      elsif new.status='Cancelled' and old.status<>'Completed'
            and not (new.operator_response = 'rejected'
                     and old.operator_response is distinct from new.operator_response) then
        v_msg := 'EV Exec: your booking '||new.ref||' has been cancelled. Please contact us if this is unexpected.';
        v_reminder_type := 'cancelled';
        v_pill := 'Booking cancelled'; v_pill_bg := '#fee2e2'; v_pill_fg := '#b91c1c';
        v_lead := 'Hi ' || evexec_esc(v_name) || ', your booking has been cancelled.';
        v_footnote := 'Please contact us if this is unexpected.';
      else v_msg := null; end if;

      if v_msg is not null and v_ch is not null then
        v_msg_html := evexec_notification_email(
          v_pill, v_pill_bg, v_pill_fg,
          v_lead,
          jsonb_build_array(
            jsonb_build_object('label','Reference','value', new.ref),
            jsonb_build_object('label','Journey',  'value', v_croute)
          ),
          v_footnote
        );
        if v_ch='email' then
          insert into notification_queue (id,booking_id,type,channel,recipient,subject,body,html,status,attempts,next_attempt_at,created_at)
          values (gen_random_uuid(),new.id,'status_update','email',v_email,'Update on your EV Exec transfer (Ref '||new.ref||')',v_msg,v_msg_html,'pending',0,now(),now());
        else
          -- Two-tap automation instead of a direct Twilio send: hand the SMS
          -- off to the assigned driver (present at En Route/Arrived by
          -- definition), or to staff if a booking is cancelled before any
          -- driver was ever assigned.
          if v_did is not null then
            insert into public.driver_sms_reminders
              (booking_id, driver_id, reminder_type, customer_name, customer_phone, travel_date, travel_time, message, status)
            values
              (new.id, v_did, v_reminder_type, v_name, v_phone, new.travel_date, new.travel_time, v_msg, 'pending')
            on conflict (booking_id, reminder_type) do nothing;
          else
            insert into public.operator_sms_tasks
              (booking_id, kind, customer_name, customer_phone, message, status)
            values
              (new.id, 'cancellation', v_name, v_phone, v_msg, 'pending')
            on conflict (booking_id, kind) do nothing;
          end if;
        end if;
      end if;
    end if;
  end if;

  return new;
end;
$function$;

commit;
