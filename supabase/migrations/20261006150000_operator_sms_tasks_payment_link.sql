-- Two-tap "Send Payment Link": the operator app's /api/payment-link writes an
-- operator_sms_tasks row (kind 'payment_link') with the customer's number and
-- a pre-filled message holding the Stripe link; the operator opens it in
-- Messages from /operator/sms-tasks/[id] and marks it sent. No Twilio.
--
-- Additive: only widens the allowed kinds. One payment_link task per booking
-- (the existing unique (booking_id, kind)); a re-send updates that row with
-- the new link.

alter table public.operator_sms_tasks drop constraint operator_sms_tasks_kind_check;
alter table public.operator_sms_tasks add constraint operator_sms_tasks_kind_check
  check (kind = any (array['confirmation'::text, 'rejection'::text, 'cancellation'::text, 'payment_link'::text]));
