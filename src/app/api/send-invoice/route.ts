import { createClient } from "@supabase/supabase-js";
import { emailLayout, emailLead, emailRow, emailFootnote } from "@/lib/emailLayout";

// Emails an invoice PDF to the customer via Resend.
//
// The browser renders the on-screen invoice to a PDF and posts it here as
// base64; this route verifies the caller is signed-in AND staff for the
// specific tenant that owns the invoice (by re-fetching the invoice row
// through an RLS-scoped client built from the caller's own JWT — the
// `staff_all_invoices` policy already restricts that read to
// `private.staff_for_tenant(tenant_id)`, so a row coming back at all IS the
// authorization check), then hands the PDF to Resend as an attachment on a
// short branded email. Kept server-side so the Resend API key never reaches
// the client.
//
// The recipient/name/number/total are read from that same DB row rather than
// trusted from the client payload, and the invoice is flipped to "Sent"
// here (not left to a separate, unguarded client-side write) once Resend
// confirms the send — so a send can never leave the invoice silently stuck
// on "Draft".
//
// Required env (set in Vercel project settings):
//   RESEND_API_KEY               — re_… from resend.com (Domains → Add domain, verify evexec.co.uk)
//   NEXT_PUBLIC_SUPABASE_URL      — already configured
//   NEXT_PUBLIC_SUPABASE_ANON_KEY — already configured (used to verify the caller's JWT)
// Optional:
//   INVOICE_FROM                 — sender, default "EV Exec <book@evexec.co.uk>"
//                                  (the domain must be verified in Resend)
//   INVOICE_REPLY_TO             — reply-to, default "book@evexec.co.uk"

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const FROM = process.env.INVOICE_FROM ?? "EV Exec <book@evexec.co.uk>";
const REPLY_TO = process.env.INVOICE_REPLY_TO ?? "book@evexec.co.uk";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

// Same shell/palette as every other customer email in the system.
function emailHtml(name: string, number: string, total: string) {
  const body = [
    emailLead(`Dear ${name || "Customer"}, please find your EV Exec invoice attached as a PDF.`),
    emailRow("Invoice", number),
    emailRow("Total Due", total, true),
    emailFootnote("Payment is due within 15 days of the invoice date. Bank transfer / BACS is preferred. If you have any questions, simply reply to this email."),
  ].filter(Boolean).join("");
  return emailLayout({ title: "Your Invoice", body });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) {
    return json({ error: "Server not configured.", configured: false }, 503);
  }
  if (!RESEND_API_KEY) {
    return json(
      {
        error:
          "Emailing invoices isn't set up yet. Add RESEND_API_KEY (and verify your sender domain in Resend) in the Vercel project settings.",
        configured: false,
      },
      503
    );
  }

  // ── Verify the caller is a signed-in operator (anon key validates the JWT) ──
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "Not authorised." }, 401);

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  // ── Parse the payload ───────────────────────────────────────────────────────
  let body: { pdfBase64?: string; invoiceId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const invoiceId = (body.invoiceId ?? "").trim();
  const pdfBase64 = (body.pdfBase64 ?? "").replace(/^data:.*;base64,/, "").trim();

  if (!invoiceId) return json({ error: "Missing invoice." }, 400);
  if (!pdfBase64) return json({ error: "Could not build the invoice PDF." }, 422);
  // Guard against oversized attachments (Resend caps ~40MB; keep well under).
  if (pdfBase64.length > 8_000_000) return json({ error: "The invoice PDF is too large to email." }, 422);

  // ── Re-fetch the invoice through an RLS-scoped client (the caller's own JWT,
  //    not the service role) — `staff_all_invoices` only returns rows where
  //    `private.staff_for_tenant(tenant_id)` holds, so getting a row back at
  //    all *is* the tenant/staff authorization check. This also gives us the
  //    authoritative recipient/name/number/total instead of trusting whatever
  //    the client happened to send. ──────────────────────────────────────────
  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: invoice, error: invoiceErr } = await scoped
    .from("invoices")
    .select("id, invoice_number, customer_name, customer_email, total, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (invoiceErr) return json({ error: "Could not look up the invoice." }, 500);
  if (!invoice) return json({ error: "Invoice not found, or you don't have access to it." }, 403);

  const to = (invoice.customer_email ?? "").trim();
  const number = invoice.invoice_number || "Invoice";
  const total = `£${Number(invoice.total ?? 0).toFixed(2)}`;
  const name = invoice.customer_name ?? "";

  if (!isEmail(to)) return json({ error: "This invoice has no valid customer email address." }, 422);

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

  // Flip Draft → Sent here, tied to the send actually succeeding, rather than
  // leaving it to a second, independent client-side write. Never overwrite a
  // Paid or Void invoice that happened to be re-sent.
  if (invoice.status !== "Paid" && invoice.status !== "Void") {
    await scoped.from("invoices").update({ status: "Sent" }).eq("id", invoiceId);
  }

  return json({ ok: true, status: invoice.status === "Paid" || invoice.status === "Void" ? invoice.status : "Sent" });
}
