import { createClient } from "@supabase/supabase-js";
import { paymentLink } from "@/lib/email/content.js";
import { when } from "@/lib/email/template.js";

// Generates a Stripe payment link for a booking and sends it to the customer.
//
// - Email (Resend), in the shared EV Exec email design, when the booking has
//   an email address.
// - A two-tap text: the response carries an `sms:` link with the message
//   already written, which the operator opens from their own phone and sends.
//   No Twilio: nothing is queued for an SMS provider.
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
//   RESEND_API_KEY               — to email the link (otherwise text only)
//   INVOICE_FROM / INVOICE_REPLY_TO — sender / reply-to, as booking-response
//   NEXT_PUBLIC_SITE_URL         — base for Stripe success/cancel redirects

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evexecoperator.vercel.app";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

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

  // Signed in isn't enough (website customers have logins on this project):
  // the caller must be staff, and below, of the business that owns the booking.
  const { data: roles } = await admin
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", userData.user.id)
    .in("role", ["super_admin", "operator_admin", "dispatcher"]);
  const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
  const staffTenants = new Set((roles ?? []).map((r) => r.tenant_id).filter(Boolean));
  if (!isSuper && staffTenants.size === 0) return json({ error: "Not authorised." }, 403);

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
    .select("*")
    .eq("ref", ref)
    .single();

  if (bErr || !booking) return json({ error: "Booking not found." }, 404);
  if (!isSuper && !staffTenants.has(booking.tenant_id)) return json({ error: "Booking not found." }, 404);

  const phone = (booking.customer_phone ?? "").trim();
  const email = (booking.customer_email ?? "").trim();
  if (!phone && !isEmail(email)) {
    return json({ error: "This booking has no customer email or phone number." }, 422);
  }

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
  if (isEmail(email)) form.set("customer_email", email);
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

  await admin
    .from("bookings")
    .update({ stripe_session_id: session.id, payment_method: "Payment link" })
    .eq("id", booking.id);

  // ── Email (Resend) ──────────────────────────────────────────────────────────
  let emailed = false;
  let emailError = "";
  if (isEmail(email) && RESEND_API_KEY) {
    const mail = paymentLink(booking, { url: session.url, amount });
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          reply_to: REPLY_TO,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
      emailed = res.ok;
      if (!res.ok) {
        try { const j = await res.json(); emailError = j?.message || j?.error || ""; } catch { /* ignore */ }
      }
    } catch (e) {
      emailError = (e as Error)?.message ?? "email send failed";
    }
  } else if (isEmail(email)) {
    emailError = "Email is not set up (RESEND_API_KEY missing).";
  }

  // ── Two-tap text: the operator sends it from their own phone ────────────────
  let smsHref: string | null = null;
  if (phone) {
    const first = String(booking.customer_name ?? "").trim().split(/\s+/)[0] || "there";
    const whenText = when(booking.travel_date, booking.travel_time);
    const body =
      `Hi ${first}, here is the secure card payment link (£${amount.toFixed(2)}) for your EV Exec transfer` +
      `${whenText ? ` on ${whenText}` : ""} (Ref ${booking.ref}): ${session.url} ` +
      `Any questions, call 07721 070370. Thank you, EV Exec`;
    smsHref = `sms:${phone.replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
  }

  return json({
    url: session.url,
    emailed,
    emailTo: emailed ? email : null,
    emailError: emailError || null,
    smsHref,
  });
}
