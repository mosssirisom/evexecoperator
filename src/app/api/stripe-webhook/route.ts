import { createClient } from "@supabase/supabase-js";
import { verifyStripeSignature } from "@/lib/stripeSignature";

// Receives Stripe webhook events and marks bookings paid when their Checkout
// Session completes. Pairs with /api/payment-link, which creates the session
// with client_reference_id = booking ref.
//
// Required env (set in Vercel project settings):
//   STRIPE_WEBHOOK_SECRET        — whsec_… from the Stripe webhook endpoint
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (server only)
//   NEXT_PUBLIC_SUPABASE_URL     — already configured for the client
// Optional (operator alert on payment — see below):
//   WEBSITE_API_URL, OPERATOR_ACTION_SECRET
//
// Stripe must be pointed at:  https://<site>/api/stripe-webhook
// subscribed to at least the `checkout.session.completed` event.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function notifyOperatorPaymentConfirmed(bookingId: string) {
  const websiteUrl = process.env.WEBSITE_API_URL || process.env.NEXT_PUBLIC_WEBSITE_URL;
  const secret = process.env.OPERATOR_ACTION_SECRET;
  if (!websiteUrl || !secret) return; // not configured — payment is still recorded either way

  try {
    await fetch(`${websiteUrl}/api/notifications/payment-confirmed`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-secret": secret },
      body: JSON.stringify({ booking_id: bookingId }),
    });
  } catch {
    // Never let a notification failure affect the webhook's response to Stripe.
  }
}

export async function POST(req: Request) {
  if (!WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response("Webhook not configured", { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig || !verifyStripeSignature(rawBody, sig, WEBHOOK_SECRET)) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  // We only act on a successfully completed/paid checkout.
  const isPaidCheckout =
    (event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded") &&
    (event.data?.object?.payment_status === "paid" ||
      event.data?.object?.status === "complete");

  if (!isPaidCheckout) {
    // Acknowledge everything else so Stripe doesn't retry.
    return new Response("ignored", { status: 200 });
  }

  const session = event.data!.object as {
    id?: string;
    client_reference_id?: string;
    metadata?: { booking_ref?: string };
  };
  const ref = session.client_reference_id ?? session.metadata?.booking_ref;
  if (!ref) return new Response("no booking ref", { status: 200 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("bookings")
    .update({ payment_status: "Paid" })
    .eq("ref", ref)
    .select("id")
    .single();

  if (error) {
    // 500 → Stripe will retry, which is what we want on a transient DB error.
    return new Response(`update failed: ${error.message}`, { status: 500 });
  }

  // The database update above was previously the ONLY effect of a payment
  // succeeding — nobody was ever told. Alert the operator now (SMS+email),
  // via the same evexec bridge used for booking confirmations. Never let a
  // failure here turn into a 500 (would make Stripe retry indefinitely for
  // a payment that already succeeded and was already recorded).
  if (data?.id) {
    await notifyOperatorPaymentConfirmed(data.id).catch(() => {});
  }

  return new Response("ok", { status: 200 });
}
