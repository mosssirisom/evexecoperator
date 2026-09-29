import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Two-tap operator SMS handoff for customer-facing sends that happen before
// a driver is assigned (booking confirmation / rejection notice) -- the
// generated message is stored in operator_sms_tasks, every subscribed
// operator device gets a push deep-linking to /operator/sms-tasks/[id], and
// a staff member reviews + sends it themselves via their own phone's native
// Messages app. No Twilio call anywhere in this flow.
//
// Mirrors evexec's own handOffSmsToOperator() (lib/notify.js), reimplemented
// here with a service-role client so evexecoperator's own accept/reject
// flow (/api/booking-response) doesn't have to fall back to a direct Twilio
// send (queue_customer_sms) the way it used to.
//
// Required env: SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type OperatorSmsHandoffResult = { ok: true } | { ok: false; error: string };

export async function handOffSmsToOperator(
  bookingId: string,
  kind: "confirmation" | "rejection",
  customerName: string,
  customerPhone: string,
  message: string
): Promise<OperatorSmsHandoffResult> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { ok: false, error: "Two-tap SMS handoff isn't set up (missing SUPABASE_SERVICE_ROLE_KEY)." };
  }
  if (!customerPhone) return { ok: false, error: "No phone number on file for this customer." };

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ignoreDuplicates -> ON CONFLICT (booking_id, kind) DO NOTHING: a retried
  // send never creates (or re-pushes) a second task for the same booking/kind.
  const { data: task, error: insErr } = await admin
    .from("operator_sms_tasks")
    .upsert(
      { booking_id: bookingId, kind, customer_name: customerName || null, customer_phone: customerPhone, message, status: "pending" },
      { onConflict: "booking_id,kind", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();
  if (insErr) return { ok: false, error: insErr.message };
  if (!task) return { ok: true }; // already had a task for this booking/kind -- don't re-push

  const { data: cfg } = await admin
    .from("push_config")
    .select("vapid_public, vapid_private, vapid_subject")
    .eq("id", true)
    .maybeSingle();
  if (!cfg?.vapid_public || !cfg?.vapid_private) return { ok: true }; // task created; push just isn't configured yet

  const { data: subs } = await admin.from("operator_push_subscriptions").select("endpoint, p256dh, auth");

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:book@evexec.co.uk", cfg.vapid_public, cfg.vapid_private);
  const title = kind === "confirmation" ? "SMS confirmation needed" : "SMS notice needed";
  const payload = JSON.stringify({
    title,
    body: `Tap to send to ${customerName || "the customer"}`,
    url: `/operator/sms-tasks/${task.id}`,
    tag: "evexec-operator-sms-task",
  });

  await Promise.all(
    (subs ?? []).map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        .catch(() => {})
    )
  );

  return { ok: true };
}
