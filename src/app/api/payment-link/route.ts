import { createClient } from "@supabase/supabase-js";

// Generates a Stripe payment link for a booking and texts it to the customer.
//
// Runs server-side because it needs the Stripe secret key and the Supabase
// service-role key (to write the notification_queue row that the SMS processor
// already drains). Gated to authenticated operators: the browser sends its
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
    .select("id, ref, price, quoted_price, customer_name, customer_phone, customer_email")
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

  // ── Persist + enqueue the SMS the processor already delivers ────────────────
  await admin
    .from("bookings")
    .update({ stripe_session_id: session.id, payment_method: "Payment link" })
    .eq("id", booking.id);

  const name = (booking.customer_name ?? "").trim() || "there";
  const body =
    `EV Exec: Hi ${name}, please complete payment for your airport transfer ` +
    `(Ref ${booking.ref}): ${session.url}`;

  const { error: qErr } = await admin.from("notification_queue").insert({
    booking_id: booking.id,
    type: "payment_link",
    channel: "sms",
    recipient: phone,
    body,
    status: "pending",
    attempts: 0,
    next_attempt_at: new Date().toISOString(),
  });

  if (qErr) {
    // The link exists and the booking is updated; surface that the text failed
    // so the operator can copy the link manually.
    return json(
      { url: session.url, sent: false, error: "Link created but the text could not be queued." },
      207
    );
  }

  return json({ url: session.url, sent: true });
}
