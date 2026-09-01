import { createClient } from "@supabase/supabase-js";

// Notifies a customer that the operator has ACCEPTED or REJECTED their website
// booking. Email first (via Resend), SMS fallback (enqueued for the external
// notification processor) if the email can't be sent or there's no address.
//
// No service-role key needed: the caller's token is verified with the anon key,
// and the SMS fallback is written through the queue_customer_sms RPC.
//
// Env (Vercel project settings):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY — already set
//   RESEND_API_KEY  — re_… (verify evexec.co.uk in Resend); optional, falls back to SMS
//   INVOICE_FROM / INVOICE_REPLY_TO — reused as the sender / reply-to

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
const esc = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));

function emailHtml(accepted: boolean, name: string, ref: string, whenText: string, routeText: string) {
  const accent = accepted ? "#1f9d55" : "#c0392b";
  const heading = accepted ? "Booking confirmed" : "Booking not available";
  const lead = accepted
    ? "Good news — we've accepted your airport transfer and it's now confirmed."
    : "We're sorry, but we're unable to take this airport transfer on this occasion.";
  const closer = accepted
    ? "We'll be in touch with your driver details closer to the time. If anything changes, just reply to this email or call us."
    : "Please don't hesitate to get in touch to discuss alternatives — we'd be glad to help.";
  const rows = [
    ref ? `<tr><td style="padding:8px 0;color:#6b7280;width:110px">Reference</td><td style="padding:8px 0;font-weight:700;color:#0f1b33">${esc(ref)}</td></tr>` : "",
    whenText ? `<tr><td style="padding:8px 0;color:#6b7280">When</td><td style="padding:8px 0;font-weight:700;color:#0f1b33">${esc(whenText)}</td></tr>` : "",
    routeText ? `<tr><td style="padding:8px 0;color:#6b7280">Journey</td><td style="padding:8px 0;font-weight:700;color:#0f1b33">${esc(routeText)}</td></tr>` : "",
  ].join("");
  return `<!doctype html><html><body style="margin:0;background:#eef0f3;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="background:#0B132B;padding:22px 28px">
        <div style="color:#d7a23f;font-size:20px;font-weight:700;letter-spacing:.22em">EV EXEC</div>
        <div style="color:#9aa3b2;font-size:10px;letter-spacing:.28em;margin-top:4px">PREMIUM AIRPORT TRANSFERS</div>
      </td></tr>
      <tr><td style="background:${accent};padding:12px 28px;color:#fff;font-size:16px;font-weight:700">${heading}</td></tr>
      <tr><td style="padding:26px 28px">
        <p style="margin:0 0 14px;font-size:15px">Hi ${esc(name) || "there"},</p>
        <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#334155">${lead}</p>
        ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-top:1px solid #eef0f3;border-bottom:1px solid #eef0f3;margin:0 0 16px">${rows}</table>` : ""}
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155">${closer}</p>
        <p style="margin:20px 0 0;font-size:14px;color:#334155">Kind regards,<br/>The EV Exec Team</p>
      </td></tr>
      <tr><td style="background:#0B132B;padding:14px 28px;color:#9aa3b2;font-size:11px">
        EV Exec · Premium Airport Transfers · 07721 070370 · book@evexec.co.uk · evexec.co.uk
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
  const db = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
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
