/**
 * Supabase Edge Function: create-payment-link
 *
 * Creates a Stripe Payment Link and returns the URL. Falls back gracefully
 * when the Stripe secret key is not configured.
 *
 * Required Supabase secret:
 *   STRIPE_SECRET_KEY    - sk_live_... or sk_test_...
 *
 * Request body (JSON):
 *   {
 *     bookingRef: string,
 *     amount: number,       // in pence / cents (e.g. 16000 = £160.00)
 *     currency?: string,    // default "gbp"
 *     description: string,  // e.g. "Airport transfer — Manchester to Blackpool"
 *     customerEmail?: string,
 *   }
 *
 * Response:
 *   { ok: boolean, configured: boolean, url?: string, reason?: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { bookingRef, amount, currency = "gbp", description, customerEmail } = await req.json();

    if (!bookingRef || !amount || !description) {
      return new Response(
        JSON.stringify({ ok: false, configured: false, reason: "Missing required fields: bookingRef, amount, description" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      return new Response(
        JSON.stringify({ ok: false, configured: false, reason: "STRIPE_SECRET_KEY not configured" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Create a Price object
    const priceBody = new URLSearchParams({
      "unit_amount": String(amount),
      "currency": currency,
      "product_data[name]": description,
      "product_data[metadata][booking_ref]": bookingRef,
    });

    const priceRes = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: priceBody.toString(),
    });

    const price = await priceRes.json();
    if (!priceRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, configured: true, reason: price.error?.message ?? "Stripe price creation failed" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Create the Payment Link
    const linkBody = new URLSearchParams({
      "line_items[0][price]": price.id,
      "line_items[0][quantity]": "1",
      "metadata[booking_ref]": bookingRef,
      "after_completion[type]": "redirect",
      "after_completion[redirect][url]": "https://evexec.co.uk/booking-confirmed",
    });

    if (customerEmail) {
      linkBody.set("customer_creation", "always");
    }

    const linkRes = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: linkBody.toString(),
    });

    const link = await linkRes.json();
    if (!linkRes.ok) {
      return new Response(
        JSON.stringify({ ok: false, configured: true, reason: link.error?.message ?? "Stripe link creation failed" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, configured: true, url: link.url }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-payment-link] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, configured: false, reason: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
