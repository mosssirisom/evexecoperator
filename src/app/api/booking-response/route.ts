import { createClient } from "@supabase/supabase-js";
import { fmtDate } from "@/lib/dates";

// Notifies a customer that the operator has ACCEPTED or REJECTED their website
// booking. Email first (via Resend), SMS fallback (enqueued for the external
// notification processor) if the email can't be sent or there's no address.
//
// Accepted: "Booking confirmed" with the full journey details and, at the
// bottom, the Payment section: a Pay Now link to the booking's page on the
// website, where the customer pays by card (Stripe) or chooses cash. Same
// content as the website's own booking-confirmed email (evexec/lib/notify.js).
// Rejected: EV Exec cannot accommodate the journey, with an apology. No
// payment link.
//
// No service-role key needed: the caller's token is verified with the anon key,
// the booking is read as that operator (RLS), and the SMS fallback is written
// through the queue_customer_sms RPC.
//
// Env (Vercel project settings):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — already set
//   RESEND_API_KEY  — re_… (verify evexec.co.uk in Resend); optional, falls back to SMS
//   INVOICE_FROM / INVOICE_REPLY_TO — reused as the sender / reply-to
//   EVEXEC_SITE_URL — optional, the website (default https://www.evexec.co.uk)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";
const WEBSITE = (process.env.EVEXEC_SITE_URL ?? "https://www.evexec.co.uk").replace(/\/$/, "");

type Booking = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const esc = (s: unknown) =>
  String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] as string));
const str = (v: unknown) => (v == null ? "" : String(v).trim());
const time5 = (t: unknown) => {
  const m = str(t).match(/^(\d{1,2}):(\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "TBC";
};
const isReturnLeg = (b: Booking) => /^Return leg created automatically/i.test(str(b.notes));
const stops = (b: Booking) =>
  str(b.notes).split("\n").map((l) => l.trim()).filter((l) => /^Stop \d+:/i.test(l))
    .map((l) => l.replace(/^Stop \d+:\s*/i, "").trim()).filter(Boolean);
const price = (b: Booking) => {
  const p = Number(b.price ?? b.quoted_price);
  return !isReturnLeg(b) && Number.isFinite(p) && p > 0 ? `£${p.toFixed(2)}` : "";
};

// Same wording as the website's paymentLine().
function paymentLine(b: Booking): string {
  const m = str(b.payment_method).toLowerCase();
  const s = str(b.payment_status).toLowerCase();
  const bank = m === "bank transfer" || m === "bank_transfer";
  if (s === "paid") return m === "card" || m === "payment link" ? "Paid by card" : m === "cash" ? "Paid in cash" : bank ? "Paid by bank transfer" : "Paid";
  if (m === "cash") return "Cash on the day";
  if (bank) return "Bank transfer (payment pending)";
  if (m === "card") return "Card payment pending";
  return "Payment required";
}
const needsPayment = (b: Booking) => {
  const s = str(b.payment_status).toLowerCase();
  return s !== "paid" && s !== "invoiced" && Boolean(price(b));
};

const ROW_L = "padding:9px 0;color:#64748b;width:118px;border-bottom:1px solid #eef0f3;font-size:12px;text-transform:uppercase;letter-spacing:.04em;vertical-align:top";
const ROW_V = "padding:9px 0;font-weight:700;color:#0f1b33;border-bottom:1px solid #eef0f3;font-size:14px;vertical-align:top";
const SEC = "padding:14px 0 4px;color:#8a6416;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em";
const row = (label: string, value: string) =>
  value ? `<tr><td style="${ROW_L}">${esc(label)}</td><td style="${ROW_V}">${esc(value)}</td></tr>` : "";

// Journey details, in the same rows as the website's bookingDetailsHtml().
function detailsTable(b: Booking, withPrice: boolean): string {
  const rows = [row("Reference", str(b.ref))];
  if (b.return_journey) rows.push(`<tr><td colspan="2" style="${SEC}">Outbound</td></tr>`);
  rows.push(row("Pickup", str(b.pickup_location) || str(b.airport) || "To be confirmed"));
  stops(b).forEach((s, i) => rows.push(row(`Stop ${i + 1}`, s)));
  rows.push(row("Drop-off", str(b.dropoff_address) || str(b.airport) || str(b.destination) || "To be confirmed"));
  rows.push(row("Date", fmtDate(str(b.travel_date) || null) || "TBC"), row("Time", time5(b.travel_time)));
  if (str(b.flight_number)) rows.push(row("Flight", str(b.flight_number).toUpperCase()));
  if (b.return_journey) {
    rows.push(`<tr><td colspan="2" style="${SEC}">Return</td></tr>`);
    rows.push(row("Pickup", str(b.return_pickup) || str(b.return_airport) || str(b.airport) || "To be confirmed"));
    rows.push(row("Drop-off", str(b.return_destination) || str(b.pickup_location) || str(b.dropoff_address) || "To be confirmed"));
    rows.push(row("Date", fmtDate(str(b.return_date) || null) || "TBC"), row("Time", time5(b.return_time)));
    if (str(b.return_flight)) rows.push(row("Flight", str(b.return_flight).toUpperCase()));
    rows.push(`<tr><td colspan="2" style="padding:6px 0 0"></td></tr>`);
  }
  rows.push(row("Passengers", str(b.passengers) || "1"));
  if (str(b.luggage)) rows.push(row("Bags", str(b.luggage)));
  if (withPrice && price(b)) rows.push(row("Price", price(b)));
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;margin:0 0 18px">${rows.join("")}</table>`;
}

// The Payment section at the bottom of the confirmation.
function paymentSection(b: Booking, payUrl: string): string {
  const head = `<div style="border-top:2px solid #C9A550;margin-top:6px"></div>`
    + `<p style="margin:22px 0 8px;font-size:13px;font-weight:700;color:#8a6416;text-transform:uppercase;letter-spacing:.06em">Payment</p>`;
  const P = "margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155";
  if (!needsPayment(b)) return `${head}<p style="${P}">Payment: <strong style="color:#0f1b33">${esc(paymentLine(b))}</strong></p>`;
  return `${head}<p style="${P}">Your booking is confirmed. You can now pay securely by card or choose to pay cash.</p>`
    + `<p style="margin:0 0 18px"><a href="${esc(payUrl)}" style="display:inline-block;background:#C9A550;color:#0B132B;font-weight:700;font-size:15px;padding:13px 28px;border-radius:8px;text-decoration:none">Pay Now</a></p>`;
}

function emailHtml(accepted: boolean, b: Booking, payUrl: string) {
  // The one EV Exec email design: white card, navy header, gold stripe,
  // status pill, navy footer.
  const pillBg = accepted ? "#dcfce7" : "#fee2e2";
  const pillText = accepted ? "#15803d" : "#b91c1c";
  const heading = accepted ? "Booking confirmed" : "Booking unavailable";
  const first = str(b.customer_name).split(/\s+/)[0] || "there";
  const lead = accepted
    ? "Your booking is confirmed. Here are your journey details."
    : "Unfortunately, EV Exec cannot accommodate your requested journey. We apologise for the inconvenience.";
  const closer = accepted
    ? "We'll be in touch with your driver details closer to the time. If anything changes, just reply to this email or call us."
    : "No payment has been taken. If you would like to discuss another time or option, please get in touch. We'd be glad to help.";
  return `<!doctype html><html lang="en"><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
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
        <span style="display:inline-block;background:${pillBg};color:${pillText};border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700">${heading}</span>
        <p style="margin:18px 0 14px;font-size:15px;color:#0f1b33">Hi ${esc(first)},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#475569">${lead}</p>
        ${detailsTable(b, accepted)}
        ${accepted ? paymentSection(b, payUrl) : ""}
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569">${closer}</p>
        <p style="margin:20px 0 0;font-size:14px;color:#475569">Kind regards,<br/>The EV Exec Team</p>
      </td></tr>
      <tr><td bgcolor="#0B132B" style="background:#0B132B;padding:14px 28px;color:#9aa3b2;font-size:11px">
        EV Exec · Premium Airport Transfers · 07721 070370 · book@evexec.co.uk · evexec.co.uk
      </td></tr>
    </table>
    </td></tr>
    </table>
  </body></html>`;
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: "not configured" }, 503);

  // Verify the caller is a signed-in operator (anon key validates the JWT).
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "Not authorised." }, 401);
  // Send the caller's JWT on every request so the booking read and the
  // queue_customer_sms RPC run as the authenticated operator.
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  let body: { ref?: string; decision?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid request body." }, 400); }

  const ref = (body.ref ?? "").trim();
  const decision = (body.decision ?? "").trim();
  if (decision !== "accepted" && decision !== "rejected") return json({ error: "Invalid decision." }, 422);
  if (!ref) return json({ error: "Missing booking ref." }, 400);
  const accepted = decision === "accepted";

  const { data: b } = await db.from("bookings").select("*").eq("ref", ref).maybeSingle();
  if (!b) return json({ ok: false, channel: null, error: "Booking not found." }, 200);

  const first = str(b.customer_name).split(/\s+/)[0] || "there";
  const email = str(b.customer_email);
  const phone = str(b.customer_phone);
  const payUrl = `${WEBSITE}/booking?id=${encodeURIComponent(str(b.id))}`;
  const when = `${fmtDate(str(b.travel_date) || null)} ${time5(b.travel_time)}`.trim();

  const smsText = accepted
    ? `EV Exec: Hi ${first}, your booking ${ref} (${when}) is confirmed.${needsPayment(b) ? ` Pay by card or choose cash: ${payUrl}` : ""} Questions: 07721 070370`
    : `EV Exec: Hi ${first}, unfortunately EV Exec cannot accommodate your requested journey (${when}, Ref ${ref}). We apologise for the inconvenience. No payment has been taken. Questions: 07721 070370`;

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
            ? `Booking Confirmed: EV Exec Transfer (Ref ${ref})`
            : `EV Exec: Booking Unavailable (Ref ${ref})`,
          html: emailHtml(accepted, b, payUrl),
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

  // ── SMS fallback ───────────────────────────────────────────────────────────
  let smsQueued = false;
  if (!emailed && phone) {
    const { error: smsErr } = await db.rpc("queue_customer_sms", {
      p_ref: ref, p_recipient: phone, p_body: smsText, p_type: `operator_${decision}`,
    });
    smsQueued = !smsErr;
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
  return json({ ok: true, channel, emailed, smsQueued });
}
