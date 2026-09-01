import { createClient } from "@supabase/supabase-js";

// Emails an invoice PDF to the customer via Resend.
//
// The browser renders the on-screen invoice to a PDF and posts it here as
// base64; this route verifies the caller is a signed-in operator, then hands
// the PDF to Resend as an attachment on a short branded email. Kept server-side
// so the Resend API key never reaches the client.
//
// Required env (set in Vercel project settings):
//   RESEND_API_KEY               — re_… from resend.com (Domains → Add domain, verify evexec.co.uk)
//   NEXT_PUBLIC_SUPABASE_URL     — already configured
//   SUPABASE_SERVICE_ROLE_KEY    — service role key (server only)
// Optional:
//   INVOICE_FROM                 — sender, default "EV Exec <book@evexec.co.uk>"
//                                  (the domain must be verified in Resend)
//   INVOICE_REPLY_TO             — reply-to, default "book@evexec.co.uk"

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

function emailHtml(name: string, number: string, total: string) {
  const safe = (s: string) => String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  // Matches the operator app's light theme (periwinkle ground, white card,
  // navy text, gold accents). color-scheme hints reduce dark-mode inversion.
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
        <span style="display:inline-block;background:#fbf3e0;color:#8a6516;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700">Invoice ${safe(number)}</span>
        <p style="margin:18px 0 14px;font-size:15px;color:#0f1b33">Dear ${safe(name) || "Customer"},</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569">
          Please find your EV Exec invoice <strong style="color:#0f1b33">${safe(number)}</strong> attached as a PDF.
          The total due is <strong style="color:#0f1b33">${safe(total)}</strong>.
        </p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#475569">
          Payment is due within 15 days of the invoice date. Bank transfer / BACS is preferred.
          If you have any questions, simply reply to this email.
        </p>
        <p style="margin:22px 0 0;font-size:14px;color:#475569">Kind regards,<br/>The EV Exec Team</p>
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
  if (!RESEND_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return json(
      {
        error:
          "Emailing invoices isn't set up yet. Add RESEND_API_KEY (and verify your sender domain in Resend) in the Vercel project settings.",
        configured: false,
      },
      503
    );
  }

  // ── Verify the caller is a signed-in operator ──────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "Not authorised." }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  // ── Parse + validate the payload ───────────────────────────────────────────
  let body: {
    to?: string; customerName?: string; number?: string; total?: string;
    pdfBase64?: string; invoiceId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const to = (body.to ?? "").trim();
  const number = (body.number ?? "").trim() || "Invoice";
  const total = (body.total ?? "").trim();
  const name = (body.customerName ?? "").trim();
  const pdfBase64 = (body.pdfBase64 ?? "").replace(/^data:.*;base64,/, "").trim();

  if (!isEmail(to)) return json({ error: "This invoice has no valid customer email address." }, 422);
  if (!pdfBase64) return json({ error: "Could not build the invoice PDF." }, 422);
  // Guard against oversized attachments (Resend caps ~40MB; keep well under).
  if (pdfBase64.length > 8_000_000) return json({ error: "The invoice PDF is too large to email." }, 422);

  // ── Send via Resend ────────────────────────────────────────────────────────
  const filename = `${number.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      reply_to: REPLY_TO,
      subject: `Your EV Exec invoice ${number}`,
      html: emailHtml(name, number, total),
      attachments: [{ filename, content: pdfBase64 }],
    }),
  });

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.message || j?.error || "";
    } catch {
      /* ignore */
    }
    return json({ error: `Email provider rejected the send${detail ? `: ${detail}` : "."}` }, 502);
  }

  return json({ ok: true });
}
