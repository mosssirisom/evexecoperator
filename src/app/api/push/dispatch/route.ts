import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Called by the database trigger when a new website booking arrives. Verifies a
// shared secret, then sends a Web Push notification to every operator device.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const compact = (v: unknown) => (v ? String(v).split(",")[0].trim() : "");

// UK format, time first: "02:00 12/07/2027". Falls back gracefully if either
// part is missing or the date isn't a plain ISO (YYYY-MM-DD) value.
function ukWhen(dateVal: unknown, timeVal: unknown): string {
  const time = timeVal ? String(timeVal).slice(0, 5) : "";
  let date = "";
  if (dateVal) {
    const m = String(dateVal).match(/^(\d{4})-(\d{2})-(\d{2})/);
    date = m ? `${m[3]}/${m[2]}/${m[1]}` : String(dateVal);
  }
  return [time, date].filter(Boolean).join(" ");
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: "not configured" }, 503);
  const db = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  // The webhook secret (sent by the DB trigger) gates a SECURITY DEFINER
  // function that returns the VAPID keys + every subscription — so no
  // service-role key is required on the server.
  const secret = req.headers.get("x-webhook-secret") ?? "";
  const { data: bundle } = await db.rpc("get_push_dispatch_bundle", { p_secret: secret });
  if (!bundle) return json({ error: "unauthorised or not set up" }, 401);
  const cfg = bundle as {
    vapid_public: string; vapid_private: string; vapid_subject: string;
    subscriptions: { endpoint: string; p256dh: string; auth: string }[];
  };

  let payloadBody: { record?: Record<string, unknown> };
  try { payloadBody = await req.json(); } catch { payloadBody = {}; }
  const r = (payloadBody?.record ?? {}) as Record<string, unknown>;

  const customer = (r.customer_name as string) || "New customer";
  const pickup = compact(r.pickup_location || r.airport || r.direction);
  const dropoff = compact(r.dropoff_address || r.destination || r.airport);
  const route = [pickup, dropoff].filter(Boolean).join(" → ");
  const when = ukWhen(r.travel_date, r.travel_time);
  const detail = [route, when].filter(Boolean).join(" · ");

  const payload = JSON.stringify({
    title: `New booking — ${customer}`,
    body: detail || "New job request via the website",
    url: "/operator/dispatch",
    tag: r.ref ? `booking-${r.ref}` : undefined,
  });

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:book@evexec.co.uk", cfg.vapid_public, cfg.vapid_private);

  const subs = cfg.subscriptions ?? [];
  let sent = 0;
  let removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await db.rpc("unregister_operator_push", { p_endpoint: s.endpoint });
          removed++;
        }
      }
    })
  );

  return json({ ok: true, sent, removed });
}
