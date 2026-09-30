import { createClient } from "@supabase/supabase-js";
import { bookingNeedsPaymentLink, createAndSendPaymentLink } from "@/lib/paymentLink";
import { handOffSmsToOperator } from "@/lib/operatorSmsHandoff";
import { emailLayout, emailLead, emailFootnote, emailRefBadge, emailRow } from "@/lib/emailLayout";

// Notifies a customer that the operator has ACCEPTED or REJECTED their website
// booking. Email first (via Resend). If there's no email on file (or it
// fails), the SMS is handed off to staff via the two-tap system instead of
// a direct Twilio send -- see src/lib/operatorSmsHandoff.ts.
//
// On acceptance, also auto-triggers a Stripe payment link (via the same
// createAndSendPaymentLink() helper the manual "Send Payment Link" button
// uses) unless the booking is already paid or already has a payment method
// recorded. This used to require a second, separate manual click after
// Accept -- easy to forget, and the actual gap a real customer hit (accepted
// with no payment link ever sent). Payment-link failures are surfaced in the
// response but never block the acceptance itself from succeeding.
//
// Env (Vercel project settings):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — already set
//   RESEND_API_KEY  — re_… (verify evexec.co.uk in Resend); optional, falls back to SMS
//   INVOICE_FROM / INVOICE_REPLY_TO — reused as the sender / reply-to
//   STRIPE_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY — needed for the auto payment
//   link (see src/lib/paymentLink.ts) and the two-tap SMS handoff (see
//   src/lib/operatorSmsHandoff.ts); if unset, acceptance still succeeds and
//   those steps are simply skipped/reported as failed in the response

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Same shell/palette as every other customer email in the system (evexec's
// accept/reject/cancel emails, this repo's payment-link and invoice emails):
// gold accent for a confirmed booking, gray for one that isn't going ahead.
function emailHtml(accepted: boolean, name: string, ref: string, whenText: string, routeText: string) {
  const title = accepted ? "Booking Confirmed" : "Booking Not Available";
  const lead = accepted
    ? `Hi ${name || "there"}, good news — we've accepted your airport transfer and it's now confirmed.`
    : `Hi ${name || "there"}, we're sorry, but we're unable to take this airport transfer on this occasion.`;
  const closer = accepted
    ? "We'll be in touch with your driver details closer to the time. If anything changes, just reply to this email or call us."
    : "Please don't hesitate to get in touch to discuss alternatives — we'd be glad to help.";
  const body = [
    emailLead(lead),
    emailRefBadge(ref),
    emailRow("When", whenText),
    emailRow("Journey", routeText, true),
    emailFootnote(closer),
  ].filter(Boolean).join("");
  return accepted
    ? emailLayout({ title, body })
    : emailLayout({ title, body, accent: "#374151", accentText: "#fff" });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: "not configured" }, 503);

  // Verify the caller is a signed-in operator (anon key validates the JWT).
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "Not authorised." }, 401);
  // Send the caller's JWT on every request so bookings reads/writes below run
  // as the authenticated operator, scoped by RLS.
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  let body: {
    ref?: string; decision?: string; name?: string; email?: string;
    phone?: string; whenText?: string; routeText?: string;
  };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const ref = (body.ref ?? "").trim();
  const decision = (body.decision ?? "").trim();
  if (decision !== "accepted" && decision !== "rejected") return json({ error: "Invalid decision." }, 422);
  const accepted = decision === "accepted";
  const name = (body.name ?? "").trim();
  const email = (body.email ?? "").trim();
  const phone = (body.phone ?? "").trim();
  const whenText = (body.whenText ?? "").trim();
  const routeText = (body.routeText ?? "").trim();

  const smsText = accepted
    ? `EV Exec: Good news ${name || "there"}, your airport transfer${whenText ? ` (${whenText})` : ""} is confirmed. Ref ${ref}. We'll send driver details nearer the time.`
    : `EV Exec: Hi ${name || "there"}, unfortunately we can't cover your transfer${whenText ? ` (${whenText})` : ""} (Ref ${ref}). Please contact us to discuss alternatives — 07721 070370.`;

  // Resolve the booking row once: its id is needed for the two-tap SMS
  // handoff (both decisions), and payment_status/payment_method for the
  // auto-payment-link skip check (acceptance only).
  const { data: bookingRow } = await db
    .from("bookings")
    .select("id, payment_status, payment_method")
    .eq("ref", ref)
    .single();

  // ── Email first ────────────────────────────────────────────────────────────
  let emailed = false;
  let emailError = "";
  if (RESEND_API_KEY && email && isEmail(email)) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          reply_to: REPLY_TO,
          subject: accepted
            ? `Your EV Exec transfer is confirmed (Ref ${ref})`
            : `About your EV Exec transfer request (Ref ${ref})`,
          html: emailHtml(accepted, name, ref, whenText, routeText),
        }),
      });
      emailed = res.ok;
      if (!res.ok) {
        try { const j = await res.json(); emailError = j?.message || j?.error || ""; } catch { /* ignore */ }
      }
    } catch (e) {
      emailError = (e as Error)?.message ?? "email send failed";
    }
  }

  // ── SMS fallback (two-tap handoff, no Twilio) ───────────────────────────────
  let smsQueued = false;
  if (!emailed && phone && bookingRow?.id) {
    const result = await handOffSmsToOperator(
      bookingRow.id,
      accepted ? "confirmation" : "rejection",
      name,
      phone,
      smsText
    );
    smsQueued = result.ok;
  }

  const channel = emailed ? "email" : smsQueued ? "sms" : null;
  if (!channel) {
    return json({
      ok: false,
      channel: null,
      error: email || phone
        ? `Couldn't reach the customer${emailError ? `: ${emailError}` : "."}`
        : "No email or phone on file for this customer.",
    }, 200);
  }

  // ── Auto payment link on acceptance ─────────────────────────────────────────
  let paymentLink: { ok: boolean; channel?: "email" | "sms"; error?: string } | null = null;
  if (accepted && bookingRow && bookingNeedsPaymentLink(bookingRow)) {
    const result = await createAndSendPaymentLink(ref);
    paymentLink = result.ok
      ? { ok: true, channel: result.channel }
      : { ok: false, error: result.error };
  }

  return json({ ok: true, channel, emailed, smsQueued, paymentLink });
}
