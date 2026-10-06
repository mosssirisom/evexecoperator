import { createClient } from "@supabase/supabase-js";

// Creates a Stripe Checkout payment link for a booking the operator has just
// accepted, so /api/booking-response can put it in the confirmation email.
// Same Stripe session as the manual "Send Payment Link" button
// (/api/payment-link): client_reference_id + metadata[booking_ref] = ref, so
// /api/stripe-webhook marks the booking Paid when it's paid.
//
// Skipped when the booking is already paid, already has a payment method
// recorded (cash, bank transfer, card or an existing link), has no price, or
// is an auto-created return leg (paid with its outbound booking).
//
// Env (Vercel project settings): STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY,
// NEXT_PUBLIC_SUPABASE_URL; optional NEXT_PUBLIC_SITE_URL for the redirects.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evexecoperator.vercel.app";

export type AcceptPaymentLink =
  | { needed: false }
  | { needed: true; ok: true; url: string; amount: string }
  | { needed: true; ok: false; error: string };

export async function paymentLinkForAcceptedBooking(ref: string): Promise<AcceptPaymentLink> {
  if (!STRIPE_SECRET_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return { needed: true, ok: false, error: "payment links aren't set up (STRIPE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY)" };
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: booking } = await admin
    .from("bookings")
    .select("id, ref, price, quoted_price, payment_status, payment_method, customer_email, notes")
    .eq("ref", ref)
    .maybeSingle();
  if (!booking) return { needed: true, ok: false, error: "booking not found" };

  const amount = Number(booking.price ?? booking.quoted_price ?? 0);
  if ((booking.payment_status ?? "") === "Paid") return { needed: false };
  if (booking.payment_method) return { needed: false };
  if (/^Return leg created automatically/i.test(booking.notes ?? "")) return { needed: false };
  if (!Number.isFinite(amount) || amount <= 0) return { needed: false };

  const form = new URLSearchParams();
  form.set("mode", "payment");
  form.set("line_items[0][quantity]", "1");
  form.set("line_items[0][price_data][currency]", "gbp");
  form.set("line_items[0][price_data][unit_amount]", String(Math.round(amount * 100)));
  form.set("line_items[0][price_data][product_data][name]", `EV Exec airport transfer — Ref ${booking.ref}`);
  form.set("client_reference_id", booking.ref);
  form.set("metadata[booking_ref]", booking.ref);
  const customerEmail = (booking.customer_email ?? "").trim();
  if (customerEmail) form.set("customer_email", customerEmail);
  form.set("success_url", `${SITE_URL}/payment-complete?ref=${encodeURIComponent(booking.ref)}`);
  form.set("cancel_url", `${SITE_URL}/payment-cancelled?ref=${encodeURIComponent(booking.ref)}`);

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const session = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!res.ok || !session?.url) {
      return { needed: true, ok: false, error: session?.error?.message ?? "Stripe could not create the payment link" };
    }
    await admin
      .from("bookings")
      .update({ stripe_session_id: session.id, payment_method: "Payment link" })
      .eq("id", booking.id);
    return { needed: true, ok: true, url: session.url, amount: `£${amount.toFixed(2)}` };
  } catch (e) {
    return { needed: true, ok: false, error: (e as Error)?.message ?? "Stripe could not create the payment link" };
  }
}
