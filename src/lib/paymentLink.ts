import { createClient } from "@supabase/supabase-js";
import { emailLayout, emailLead, emailRefBadge, emailButton } from "@/lib/emailLayout";

// Shared by /api/payment-link (the operator's manual "Send Payment Link"
// button) and /api/booking-response (auto-triggered right after an operator
// accepts a website booking, so staff don't have to remember a second,
// separate click). Same Stripe Checkout Session + delivery logic either way
// -- email if we have one (sent here, no Twilio), or an sms: two-tap deep
// link for the operator to open themselves if not.
//
// Required env (set in Vercel project settings):
//   STRIPE_SECRET_KEY            — sk_live_… / sk_test_…
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (server only, never NEXT_PUBLIC)
//   NEXT_PUBLIC_SUPABASE_URL     — already configured for the client
// Optional:
//   NEXT_PUBLIC_SITE_URL         — base for Stripe success/cancel redirects
//   RESEND_API_KEY               — re_… (falls back to the SMS deep-link path if unset)
//   INVOICE_FROM / INVOICE_REPLY_TO — reused from send-invoice's convention

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evexecoperator.vercel.app";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Same shell/palette as every other customer email in the system.
function paymentLinkEmailHtml(name: string, ref: string, amount: string, url: string): string {
  const body = [
    emailLead(`Hi ${name || "there"}, please use the button below to complete payment for your EV Exec airport transfer.`),
    emailRefBadge(ref),
    emailButton(url, amount ? `Pay ${amount}` : "Complete Payment"),
  ].join("");
  return emailLayout({ title: "Complete Your Payment", body });
}

export type PaymentLinkResult =
  | { ok: true; url: string; channel: "email" }
  | { ok: true; url: string; channel: "sms"; smsHref: string }
  | { ok: false; error: string; status: number };

// Booking rows that shouldn't get an auto-generated payment link: already
// paid, or the operator has already arranged/recorded a different payment
// method (including a link already sent, to avoid creating a second Stripe
// session for the same booking).
export function bookingNeedsPaymentLink(booking: { payment_status?: string | null; payment_method?: string | null }): boolean {
  if ((booking.payment_status ?? "Unpaid") === "Paid") return false;
  if (booking.payment_method) return false;
  return true;
}

export async function createAndSendPaymentLink(ref: string): Promise<PaymentLinkResult> {
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return {
      ok: false,
      status: 503,
      error: "Payment links aren't set up yet. Add STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY in the Vercel project settings.",
    };
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select("id, ref, price, quoted_price, customer_name, customer_phone, customer_email")
    .eq("ref", ref)
    .single();

  if (bErr || !booking) return { ok: false, status: 404, error: "Booking not found." };

  const phone = (booking.customer_phone ?? "").trim();
  if (!phone) return { ok: false, status: 422, error: "This booking has no customer phone number." };

  const amount = Number(booking.price ?? booking.quoted_price ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, status: 422, error: "This booking has no price to charge." };
  }
  const unitAmount = Math.round(amount * 100); // pence

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
    return { ok: false, status: 502, error: session?.error?.message ?? "Stripe could not create the payment link." };
  }

  await admin
    .from("bookings")
    .update({ stripe_session_id: session.id, payment_method: "Payment link" })
    .eq("id", booking.id);

  const name = (booking.customer_name ?? "").trim() || "there";
  const amountLabel = `£${amount.toFixed(2)}`;

  if (customerEmail && isEmail(customerEmail) && RESEND_API_KEY) {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: customerEmail,
        reply_to: REPLY_TO,
        subject: `Complete payment for your EV Exec transfer (Ref ${booking.ref})`,
        html: paymentLinkEmailHtml(name, booking.ref, amountLabel, session.url),
      }),
    });

    if (resendRes.ok) {
      return { ok: true, url: session.url, channel: "email" };
    }
    // Email failed -- fall through to the sms: deep-link fallback below so
    // there's still a way to get the link to the customer.
  }

  const body =
    `EV Exec: Hi ${name}, please complete payment for your airport transfer ` +
    `(Ref ${booking.ref}): ${session.url}`;
  const smsHref = `sms:${phone}?body=${encodeURIComponent(body)}`;

  return { ok: true, url: session.url, channel: "sms", smsHref };
}
