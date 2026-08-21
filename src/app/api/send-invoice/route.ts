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
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb">
      <tr><td style="background:#04080f;padding:22px 28px">
        <div style="color:#d7a23f;font-size:20px;font-weight:700;letter-spacing:.22em">EV EXEC</div>
        <div style="color:#9aa3b2;font-size:10px;letter-spacing:.28em;margin-top:4px">PREMIUM AIRPORT TRANSFERS</div>
      </td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 14px;font-size:15px">Dear ${safe(name) || "Customer"},</p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155">
          Please find your EV Exec invoice <strong>${safe(number)}</strong> attached as a PDF.
          The total due is <strong style="color:#0f172a">${safe(total)}</strong>.
        </p>
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155">
          Payment is due within 15 days of the invoice date. Bank transfer / BACS is preferred.
          If you have any questions, simply reply to this email.
        </p>
        <p style="margin:22px 0 0;font-size:14px;color:#334155">Kind regards,<br/>The EV Exec Team</p>
      </td></tr>
      <tr><td style="background:#04080f;padding:14px 28px;color:#9aa3b2;font-size:11px">
        EV Exec · Blackpool, FY2 0FD · 07721 070370 · book@evexec.co.uk · evexec.co.uk
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
