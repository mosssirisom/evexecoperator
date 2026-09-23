import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Generic operator push notification -- the delivery half of the "two-tap
// automation": evexec's backend calls this whenever a customer-facing SMS
// (confirmation, rejection, ...) has been handed off to staff instead of
// sent via Twilio (see operator_sms_tasks). Push-notifies every subscribed
// operator device, deep-linking to wherever the caller wants (typically the
// relevant /operator/sms-tasks/[id] screen).
//
// Same webhook-secret + get_push_dispatch_bundle pattern already used by
// /api/push/dispatch for new-booking pushes -- deliberately generic here
// (title/body/url in the request body) rather than tied to a bookings row
// shape, since callers outside "new booking" need this too.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: "not configured" }, 503);
  const db = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // Gated the same way as /api/push/dispatch: the secret is checked inside
  // the SECURITY DEFINER get_push_dispatch_bundle function against
  // push_config.webhook_secret, so no service-role key is required here.
  const secret = req.headers.get("x-webhook-secret") ?? "";
  const { data: bundle } = await db.rpc("get_push_dispatch_bundle", { p_secret: secret });
  if (!bundle) return json({ error: "unauthorised or not set up" }, 401);
  const cfg = bundle as {
    vapid_public: string; vapid_private: string; vapid_subject: string;
    subscriptions: { endpoint: string; p256dh: string; auth: string }[];
  };

  let body: { title?: string; body?: string; url?: string; tag?: string };
  try { body = await req.json(); } catch { body = {}; }
  const { title, body: message, url, tag } = body;
  if (!title || !message) return json({ error: "title and body required" }, 400);

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:book@evexec.co.uk", cfg.vapid_public, cfg.vapid_private);

  const payload = JSON.stringify({
    title,
    body: message,
    url: url || "/operator/dispatch",
    tag: tag || "evexec-operator-sms-task",
  });

  const subs = cfg.subscriptions ?? [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch { /* individual subscription failure shouldn't fail the whole call */ }
    })
  );

  return json({ ok: true, sent, total: subs.length });
}
