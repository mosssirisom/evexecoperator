import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Called by the database trigger when a new website booking arrives. Verifies a
// shared secret, then sends a Web Push notification to every operator device.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const compact = (v: unknown) => (v ? String(v).split(",")[0].trim() : "");

export async function POST(req: Request) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "not configured" }, 503);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: cfg } = await admin.from("push_config").select("*").eq("id", true).maybeSingle();
  if (!cfg?.vapid_public || !cfg?.vapid_private || !cfg?.webhook_secret) {
    return json({ error: "push not set up" }, 503);
  }
  if ((req.headers.get("x-webhook-secret") ?? "") !== cfg.webhook_secret) {
    return json({ error: "unauthorised" }, 401);
  }

  let payloadBody: { record?: Record<string, unknown> };
  try { payloadBody = await req.json(); } catch { payloadBody = {}; }
  const r = (payloadBody?.record ?? {}) as Record<string, unknown>;

  const customer = (r.customer_name as string) || "New customer";
  const pickup = compact(r.pickup_location || r.airport || r.direction);
  const dropoff = compact(r.dropoff_address || r.destination || r.airport);
  const route = [pickup, dropoff].filter(Boolean).join(" → ");
  const time = r.travel_time ? String(r.travel_time).slice(0, 5) : "";
  const date = (r.travel_date as string) || "";
  const detail = [route, [date, time].filter(Boolean).join(" ")].filter(Boolean).join(" · ");

  const payload = JSON.stringify({
    title: `New booking — ${customer}`,
    body: detail || "New job request via the website",
    url: "/operator/dispatch",
    tag: r.ref ? `booking-${r.ref}` : undefined,
  });

  webpush.setVapidDetails(cfg.vapid_subject || "mailto:book@evexec.co.uk", cfg.vapid_public, cfg.vapid_private);

  const { data: subs } = await admin.from("operator_push_subscriptions").select("endpoint,p256dh,auth");
  let sent = 0;
  let removed = 0;
  await Promise.all(
    (subs ?? []).map(async (s: { endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        );
        sent++;
      } catch (e: unknown) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await admin.from("operator_push_subscriptions").delete().eq("endpoint", s.endpoint);
          removed++;
        }
      }
    })
  );

  return json({ ok: true, sent, removed });
}
