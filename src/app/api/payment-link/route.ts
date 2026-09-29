import { createClient } from "@supabase/supabase-js";
import { createAndSendPaymentLink } from "@/lib/paymentLink";

// Generates a Stripe payment link for a booking and delivers it to the
// customer. The operator-facing "Send Payment Link" button in the dispatch
// drawer calls this directly; /api/booking-response also calls the shared
// createAndSendPaymentLink() helper automatically right after an operator
// accepts a booking, so this route no longer needs to be a separate manual
// step for the common case.
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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY) return json({ error: "not configured" }, 503);

  // ── Verify the caller is a signed-in operator ──────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return json({ error: "Not authorised." }, 401);

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  // ── Resolve the booking ref ─────────────────────────────────────────────────
  let ref: string | undefined;
  try {
    const parsed = (await req.json()) as { ref?: string };
    ref = typeof parsed?.ref === "string" ? parsed.ref.trim() : undefined;
  } catch {
    /* fall through to validation below */
  }
  if (!ref) return json({ error: "Missing booking ref." }, 400);

  const result = await createAndSendPaymentLink(ref);
  if (!result.ok) return json({ error: result.error }, result.status);

  if (result.channel === "email") return json({ url: result.url, sent: true, channel: "email" });
  return json({ url: result.url, sent: false, channel: "sms", smsHref: result.smsHref });
}
