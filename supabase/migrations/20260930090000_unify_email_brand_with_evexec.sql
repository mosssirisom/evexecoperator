begin;

-- One universal email style, across every repo and every send path: dark
-- #020813 card, gold #d5a538 accent bar, logo at top, footer below the
-- card -- matching evexec/lib/emailLayout.js byte-for-byte (colors, markup
-- structure, row/reference-badge conventions). Until now, this SQL-side
-- helper used a close-but-different navy/gold approximation (#0B132B /
-- #d7a23f / #C9A550) with a bordered key/value table and a colored status
-- pill inside the body -- a real, separate brand from evexec's own emails.
-- evexec itself has no inline pill: status is conveyed by the accent-bar
-- title and color alone (gold for a positive/informational notice, gray
-- #374151 for cancelled/unavailable), so this rewrite drops the pill
-- concept rather than keeping a fourth visual language.
--
-- evexec_notification_email()'s signature changes from
--   (p_pill, p_pill_bg, p_pill_fg, p_lead, p_rows, p_footnote)
-- to
--   (p_title, p_accent, p_accent_text, p_lead, p_rows, p_footnote)
-- directly mirroring emailLayout({title, body, accent, accentText}) --
-- every call site below is updated to match.

create or replace function public.evexec_esc(p text)
returns text language sql immutable set search_path = 'public', 'pg_temp' as $$
  select replace(replace(replace(coalesce(p,''),'&','&amp;'),'<','&lt;'),'>','&gt;')
$$;

create or replace function public.evexec_notification_email(
  p_title text, p_accent text, p_accent_text text,
  p_lead text, p_rows jsonb, p_footnote text
) returns text language sql stable set search_path = 'public', 'pg_temp' as $$
  select
     '<!DOCTYPE html><html lang="en"><head>'
  || '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
  || '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">'
  || '<title>' || evexec_esc(p_title) || '</title></head>'
  || '<body style="margin:0;padding:0;background:#ffffff">'
  || '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="background:#ffffff;padding:32px 12px"><tr><td align="center">'
  || '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">'
  || '<tr><td bgcolor="#020813" style="background:#020813;padding:24px 28px 4px;border-radius:12px 12px 0 0;text-align:center">'
  ||   '<a href="https://evexec.co.uk" style="display:block;text-decoration:none">'
  ||   '<img src="https://evexec.co.uk/public/images/ev-exec-logo.jpg" alt="EV Exec" width="150" style="width:150px;height:auto;display:block;margin:0 auto;border:0" />'
  ||   '</a></td></tr>'
  || '<tr><td style="background:' || p_accent || ';padding:16px 28px">'
  ||   '<h1 style="margin:0;font-family:Inter,Arial,sans-serif;font-size:17px;font-weight:700;color:' || p_accent_text || ';line-height:1.3">' || evexec_esc(p_title) || '</h1>'
  || '</td></tr>'
  || '<tr><td bgcolor="#020813" style="background:#020813;padding:28px;border-radius:0 0 12px 12px">'
  ||   '<p style="margin:0 0 20px;font-family:Inter,Arial,sans-serif;font-size:15px;color:rgba(255,255,255,.65);line-height:1.6">' || p_lead || '</p>'
  ||   coalesce((
         select string_agg(
                  '<p style="margin:0 0 2px;font-family:Inter,Arial,sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em">'
                  || evexec_esc(e->>'label')
                  || '</p><p style="margin:0 0 ' || case when ord = jsonb_array_length(p_rows) then '20px' else '14px' end || ';font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;color:#fff;line-height:1.4">'
                  || evexec_esc(e->>'value') || '</p>',
                  '' order by ord)
         from jsonb_array_elements(p_rows) with ordinality as t(e, ord)
         where nullif(btrim(e->>'value'),'') is not null
       ),'')
  ||   case when nullif(btrim(coalesce(p_footnote,'')),'') is not null
            then '<p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:13px;color:rgba(255,255,255,.5)">' || p_footnote || '</p>'
            else '' end
  || '</td></tr>'
  || '<tr><td style="padding:20px 0 0;text-align:center">'
  ||   '<p style="margin:0;font-family:Inter,Arial,sans-serif;font-size:12px;color:#6b7280">EV Exec &nbsp;&middot;&nbsp; Premium Airport Transfers<br>'
  ||   '<a href="tel:07721070370" style="color:#d5a538;text-decoration:none">07721 070370</a> &nbsp;&middot;&nbsp; '
  ||   '<a href="https://evexec.co.uk" style="color:#d5a538;text-decoration:none">evexec.co.uk</a></p>'
  || '</td></tr>'
  || '</table></td></tr></table></body></html>'
$$;

-- ── Customer notifications: update every call site to the new signature ──────
-- (received + status_update only -- reminder_24h/7day creation was already
-- removed from this trigger in 20260923143619 to fix a genuine live
-- duplicate against evexec's own reminder cron; not reintroduced here.)
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
  v_title text; v_accent text; v_accent_text text; v_lead text; v_footnote text;
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
        'Booking Confirmed', '#d5a538', '#06101c',
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
        v_title := 'Driver On The Way'; v_accent := '#d5a538'; v_accent_text := '#06101c';
        v_lead := 'Hi ' || evexec_esc(v_name) || ', your driver is on the way.';
        v_footnote := null;
      elsif new.status='Arrived' and old.status='En Route' then
        v_msg := 'EV Exec: your driver has arrived at the pickup point. Ref '||new.ref||'.';
        v_reminder_type := 'arrived';
        v_title := 'Driver Has Arrived'; v_accent := '#d5a538'; v_accent_text := '#06101c';
        v_lead := 'Hi ' || evexec_esc(v_name) || ', your driver has arrived at the pickup point.';
        v_footnote := null;
      elsif new.status='Cancelled' and old.status<>'Completed'
            and not (new.operator_response = 'rejected'
                     and old.operator_response is distinct from new.operator_response) then
        v_msg := 'EV Exec: your booking '||new.ref||' has been cancelled. Please contact us if this is unexpected.';
        v_reminder_type := 'cancelled';
        v_title := 'Booking Cancelled'; v_accent := '#374151'; v_accent_text := '#fff';
        v_lead := 'Hi ' || evexec_esc(v_name) || ', your booking has been cancelled.';
        v_footnote := 'Please contact us if this is unexpected.';
      else v_msg := null; end if;

      if v_msg is not null and v_ch is not null then
        v_msg_html := evexec_notification_email(
          v_title, v_accent, v_accent_text,
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

-- ── Driver notifications: update to the new signature ─────────────────────────
create or replace function public.enqueue_driver_notifications()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp'
as $function$
declare
  v_new_driver uuid := coalesce(new.assigned_driver_id, new.driver_id);
  v_old_driver uuid := case when tg_op='UPDATE' then coalesce(old.assigned_driver_id, old.driver_id) else null end;
  v_driver_changed boolean := (tg_op='INSERT' and v_new_driver is not null) or (tg_op='UPDATE' and v_new_driver is distinct from v_old_driver);
  v_pay_changed boolean := (tg_op='UPDATE' and new.payment_status is distinct from old.payment_status);
  v_phone text; v_email text; v_route text; v_routed text;
  v_time5   text := substring(coalesce(new.travel_time,'') from 1 for 5);
  v_ukdate  text := case when new.travel_date is not null then to_char(new.travel_date,'DD/MM/YYYY') else null end;
  v_timetxt text := nullif(btrim(coalesce(v_time5,'') || ' ' || coalesce(v_ukdate,'')), '');
  v_sched   timestamptz := coalesce(
              new.pickup_time,
              case when new.travel_date is not null and new.travel_time ~ '^[0-2]?[0-9]:[0-5][0-9](:[0-5][0-9])?$'
                   then (new.travel_date::text || ' ' || new.travel_time)::timestamp at time zone 'Europe/London'
                   else null end);
  v_cust text := coalesce(nullif(trim(new.customer_name),''),'Customer');
  v_custphone text := nullif(trim(new.customer_phone),'');
  v_status text := lower(coalesce(new.payment_status,''));
  v_fare text; v_farev text; v_alloc text; v_remind text;
  v_drows jsonb; v_alloc_html text; v_remind_html text;
begin
  if tg_op='UPDATE' and v_new_driver is distinct from v_old_driver then
    delete from notification_queue where booking_id=new.id and type='driver_reminder_24h' and status='pending';
  end if;
  if v_new_driver is null then return new; end if;
  if not v_driver_changed and not v_pay_changed then return new; end if;

  select nullif(trim(phone),''), nullif(trim(email),'') into v_phone, v_email from drivers where id=v_new_driver;
  if v_email is null then return new; end if;

  v_route := case
    when nullif(new.pickup_location,'') is not null and nullif(new.dropoff_address,'') is not null
      then new.pickup_location || ' -> ' || new.dropoff_address
    when new.direction='Destination → Airport'
      then coalesce(nullif(new.dropoff_address,''),nullif(new.pickup_location,''),'Pickup') || ' -> ' || coalesce(nullif(new.airport,''),'Airport')
    else coalesce(nullif(new.airport,''),'Airport') || ' -> ' || coalesce(nullif(new.dropoff_address,''),nullif(new.pickup_location,''),'Destination')
  end;
  v_routed := replace(v_route, ' -> ', ' → ');

  if v_status='paid' then v_fare := ' Fare: PAID in advance — nothing to collect.'; v_farev := 'Paid in advance — nothing to collect';
  elsif v_status='invoiced' then v_fare := ' Fare: invoiced to account — do not collect.'; v_farev := 'Invoiced to account — do not collect';
  elsif new.quoted_price is not null then v_fare := ' Fare to collect GBP ' || trim(to_char(new.quoted_price,'FM999990.00')) || '.'; v_farev := '£' || trim(to_char(new.quoted_price,'FM999990.00')) || ' to collect';
  else v_fare := ' Fare: TBC.'; v_farev := 'TBC'; end if;

  v_drows := jsonb_build_array(
    jsonb_build_object('label','Reference',  'value', new.ref),
    jsonb_build_object('label','When',       'value', v_timetxt),
    jsonb_build_object('label','Journey',    'value', v_routed),
    jsonb_build_object('label','Customer',   'value', v_cust || coalesce(' · ' || v_custphone,'')),
    jsonb_build_object('label','Flight',     'value', nullif(new.flight_number,'')),
    jsonb_build_object('label','Passengers', 'value', new.passengers::text),
    jsonb_build_object('label','Bags',       'value', nullif(new.luggage,'')),
    jsonb_build_object('label','Fare',       'value', v_farev)
  );

  v_remind := 'EV Exec REMINDER — Job ' || new.ref || ' tomorrow at ' || coalesce(nullif(v_time5,''),'the booked time') || ': ' || v_route
    || '. Customer ' || v_cust || coalesce(' ' || v_custphone,'') || coalesce('. Flight ' || nullif(new.flight_number,''),'')
    || coalesce('. Pax ' || new.passengers::text,'') || coalesce('. Bags ' || nullif(new.luggage,''),'') || '.' || v_fare;
  v_remind_html := evexec_notification_email(
    'Reminder: Job Tomorrow', '#d5a538', '#06101c',
    'This is a reminder for your job tomorrow at ' || coalesce(nullif(v_time5,''),'the booked time') || '.',
    v_drows, 'Please be ready in good time. Drive safely.');

  if v_driver_changed then
    v_alloc := 'EV Exec NEW JOB ' || new.ref || ': ' || v_route || coalesce(' on ' || v_timetxt,'')
      || '. Customer ' || v_cust || coalesce(' ' || v_custphone,'') || coalesce('. Flight ' || nullif(new.flight_number,''),'')
      || coalesce('. Pax ' || new.passengers::text,'') || coalesce('. Bags ' || nullif(new.luggage,''),'') || '.';
    v_alloc_html := evexec_notification_email(
      'New Job', '#d5a538', '#06101c',
      'A new job has been assigned to you.',
      v_drows, 'Please be ready in good time. Drive safely.');

    insert into notification_queue (id,booking_id,type,channel,recipient,subject,body,html,status,attempts,next_attempt_at,created_at)
    select gen_random_uuid(),new.id,'driver_allocated','email',v_email,'New job '||new.ref||' — '||v_routed,v_alloc,v_alloc_html,'pending',0,now(),now()
    where not exists (select 1 from notification_queue q where q.booking_id=new.id and q.type='driver_allocated' and q.status='pending');

    if v_sched is not null and v_sched - interval '24 hours' > now() then
      insert into notification_queue (id,booking_id,type,channel,recipient,subject,body,html,status,attempts,next_attempt_at,created_at)
      values (gen_random_uuid(),new.id,'driver_reminder_24h','email',v_email,'Reminder: job '||new.ref||' tomorrow',v_remind,v_remind_html,'pending',0,v_sched - interval '24 hours',now());
    end if;

  elsif v_pay_changed then
    update notification_queue set body=v_remind, html=case when channel='email' then v_remind_html else html end
     where booking_id=new.id and type='driver_reminder_24h' and status='pending';
  end if;

  return new;
end;
$function$;

commit;
