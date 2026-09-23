import { createClient } from "@supabase/supabase-js";

// Generates a Stripe payment link for a booking and delivers it to the
// customer -- email if they have one on file (sent right here, no Twilio),
// or an sms: two-tap link for the operator to send themselves if not (this
// action is already operator-initiated and synchronous, so there's no need
// to push-notify them of something they just did -- the frontend opens the
// Messages composer directly from the response).
//
// Required env (set in Vercel project settings):
//   STRIPE_SECRET_KEY            — sk_live_… / sk_test_…
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (server only, never NEXT_PUBLIC)
//   NEXT_PUBLIC_SUPABASE_URL     — already configured for the client
// Optional:
//   NEXT_PUBLIC_SITE_URL         — base for Stripe success/cancel redirects
//   RESEND_API_KEY               — re_… (falls back to the SMS deep-link path if unset)
//   INVOICE_FROM / INVOICE_REPLY_TO — reused from send-invoice's convention

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://evexecoperator.vercel.app";
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

function paymentLinkEmailHtml(name: string, ref: string, amount: string, url: string): string {
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
  <style>:root{color-scheme:light;supported-color-schemes:light}</style>
  </head>
  <body style="margin:0;background:#E9EBF2;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f1b33">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#E9EBF2" style="background:#E9EBF2">
    <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e5ee">
      <tr><td bgcolor="#0B132B" style="background:#0B132B;padding:22px 28px">
        <div style="color:#d7a23f;font-size:20px;font-weight:800;letter-spacing:.22em">EV EXEC</div>
        <div style="color:#9aa3b2;font-size:10px;letter-spacing:.28em;margin-top:4px">PREMIUM AIRPORT TRANSFERS</div>
      </td></tr>
      <tr><td bgcolor="#C9A550" style="background:#C9A550;height:4px;line-height:4px;font-size:0">&nbsp;</td></tr>
      <tr><td bgcolor="#ffffff" style="background:#ffffff;padding:26px 28px">
        <p style="margin:0 0 14px;font-size:15px;color:#0f1b33">Hi ${esc(name) || "there"},</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#475569">
          Please use the link below to complete payment for your EV Exec airport transfer (Ref ${esc(ref)}).
        </p>
        <p style="margin:0 0 20px">
          <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#f1c56a,#d5a538 55%,#a97918);color:#020813;font-weight:700;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none">
            ${amount ? `Pay ${esc(amount)}` : "Complete Payment"}
          </a>
        </p>
        <p style="margin:0;font-size:14px;color:#475569">Kind regards,<br/>The EV Exec Team</p>
      </td></tr>
      <tr><td bgcolor="#0B132B" style="background:#0B132B;padding:14px 28px;color:#9aa3b2;font-size:11px">
        EV Exec · Blackpool, FY2 0FD · 07721 070370 · book@evexec.co.uk · evexec.co.uk
      </td></tr>
    </table>
    </td></tr>
    </table>
  </body></html>`;
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

  // ── Persist, then deliver: email if we have one (no Twilio), else a two-tap
  // sms: deep link for the operator to send themselves ─────────────────────
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
      return json({ url: session.url, sent: true, channel: "email" });
    }
    // Email failed -- fall through to the sms: deep-link fallback below so
    // the operator still has a way to get the link to the customer.
  }

  const body =
    `EV Exec: Hi ${name}, please complete payment for your airport transfer ` +
    `(Ref ${booking.ref}): ${session.url}`;
  const smsHref = `sms:${phone}?body=${encodeURIComponent(body)}`;

  return json({ url: session.url, sent: false, channel: "sms", smsHref });
}
