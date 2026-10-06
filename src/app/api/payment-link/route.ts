import { createClient } from "@supabase/supabase-js";
import { fmtDate } from "@/lib/dates";

// Generates a Stripe payment link for a booking and hands it to the operator
// as a two-tap text: an operator_sms_tasks row (kind 'payment_link') holding
// the customer's number and a pre-filled message with the link. The response
// carries the task id; the dispatch screen opens /operator/sms-tasks/[id],
// where the operator taps "Open Messages", sends it from their own phone,
// then taps "Mark as Sent". No Twilio.
//
// Runs server-side because it needs the Stripe secret key and the Supabase
// service-role key. Gated to authenticated operators: the browser sends its
// Supabase access token as a Bearer header and we verify it before doing
// anything chargeable.
//
// Required env (set in Vercel project settings):
//   STRIPE_SECRET_KEY            — sk_live_… / sk_test_…
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (server only, never NEXT_PUBLIC)
//   NEXT_PUBLIC_SUPABASE_URL     — already configured for the client
// Optional:
//   NEXT_PUBLIC_SITE_URL         — base for Stripe success/cancel redirects

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evexecoperator.vercel.app";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(
      {
        error:
          "Payment links aren't set up yet. Add STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY in the Vercel project settings.",
        configured: false,
      },
      503
    );
  }

  // ── Verify the caller is a signed-in operator ──────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return json({ error: "Not authorised." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  // ── Resolve the booking ────────────────────────────────────────────────────
  let ref: string | undefined;
  try {
    const parsed = (await req.json()) as { ref?: string };
    ref = typeof parsed?.ref === "string" ? parsed.ref.trim() : undefined;
  } catch {
    /* fall through to validation below */
  }
  if (!ref) return json({ error: "Missing booking ref." }, 400);

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select("id, ref, tenant_id, price, quoted_price, customer_name, customer_phone, customer_email, travel_date, travel_time")
    .eq("ref", ref)
    .single();

  if (bErr || !booking) return json({ error: "Booking not found." }, 404);

  const phone = (booking.customer_phone ?? "").trim();
  if (!phone) return json({ error: "This booking has no customer phone number." }, 422);

  const amount = Number(booking.price ?? booking.quoted_price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return json({ error: "This booking has no price to charge." }, 422);
  }
  const unitAmount = Math.round(amount * 100); // pence

  // ── Create a Stripe Checkout Session ───────────────────────────────────────
  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "gbp");
  form.set("line_items[0][price_data][unit_amount]", String(unitAmount));
  form.set(
    "line_items[0][price_data][product_data][name]",
    `EV Exec airport transfer — Ref ${booking.ref}`
  );
  form.set("client_reference_id", booking.ref);
  form.set("metadata[booking_ref]", booking.ref);
  // Pre-fill the Stripe checkout email; if "Successful payment" receipts are
  // enabled in the Stripe Dashboard, Stripe also emails its own receipt.
  const customerEmail = (booking.customer_email ?? "").trim();
  if (customerEmail) form.set("customer_email", customerEmail);
  form.set("success_url", `${SITE_URL}/payment-complete?ref=${encodeURIComponent(booking.ref)}`);
  form.set("cancel_url", `${SITE_URL}/payment-cancelled?ref=${encodeURIComponent(booking.ref)}`);

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });

  const session = (await stripeRes.json()) as { id?: string; url?: string; error?: { message?: string } };
  if (!stripeRes.ok || !session?.url) {
    return json(
      { error: session?.error?.message ?? "Stripe could not create the payment link." },
      502
    );
  }

  // ── Persist, then hand the operator a two-tap text ─────────────────────────
  await admin
    .from("bookings")
    .update({ stripe_session_id: session.id, payment_method: "Payment link" })
    .eq("id", booking.id);

  const first = (booking.customer_name ?? "").trim().split(/\s+/)[0] || "there";
  const travel = [fmtDate(booking.travel_date), String(booking.travel_time ?? "").slice(0, 5)].filter(Boolean).join(" at ");
  const message =
    `EV Exec: Hi ${first}, please pay £${amount.toFixed(2)} for your transfer` +
    `${travel ? ` on ${travel}` : ""} (Ref ${booking.ref}) using this secure link: ${session.url}\n` +
    `The link is valid for 24 hours. Questions: 07721 070370`;

  // One payment-link task per booking: a re-send replaces the message (new
  // link) and puts it back to pending.
  const { data: task, error: tErr } = await admin
    .from("operator_sms_tasks")
    .upsert(
      {
        booking_id: booking.id,
        ...(booking.tenant_id ? { tenant_id: booking.tenant_id } : {}),
        kind: "payment_link",
        customer_name: booking.customer_name ?? null,
        customer_phone: phone,
        message,
        status: "pending",
        opened_at: null,
        sent_at: null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "booking_id,kind" }
    )
    .select("id")
    .single();

  if (tErr || !task) {
    // The link exists and the booking is updated; return the text anyway so
    // the operator can still send it.
    return json({ url: session.url, taskId: null, smsHref: `sms:${phone.replace(/\s+/g, "")}?body=${encodeURIComponent(message)}` });
  }

  return json({ url: session.url, taskId: task.id });
}
