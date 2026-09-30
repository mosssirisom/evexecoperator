import { createClient } from "@supabase/supabase-js";

// Returns a booking's logged expenses (parking, ULEZ, tolls, etc.) so staff
// can choose which to include when invoicing that job.
//
// booking_expenses has no staff-facing RLS policy — drivers can only read
// the rows for bookings assigned to them (`driver_own_expenses`), so staff
// can't read it with their own session. Instead: verify the caller is staff
// for the booking's tenant by re-fetching the booking through an RLS-scoped
// client built from the caller's own JWT (the `bookings` table's own staff
// policy means a row only comes back if they're actually staff for that
// tenant — same "the read succeeding is the authorization check" pattern as
// /api/send-invoice), then read the expenses with the service role.
//
// Required env (already configured for the rest of this app):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: Request) {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    return json({ error: "Server not configured.", configured: false }, 503);
  }

  const bookingId = (new URL(req.url).searchParams.get("bookingId") ?? "").trim();
  if (!bookingId) return json({ error: "Missing bookingId." }, 400);

  // ── Verify the caller is a signed-in operator ──────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return json({ error: "Not authorised." }, 401);

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "Not authorised." }, 401);

  // ── Re-fetch the booking through an RLS-scoped client — getting a row back
  //    at all is the tenant/staff authorization check for this booking. ──────
  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: booking, error: bookingErr } = await scoped
    .from("bookings")
    .select("id")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookingErr) return json({ error: "Could not look up the booking." }, 500);
  if (!booking) return json({ error: "Booking not found, or you don't have access to it." }, 403);

  // ── Read the expenses with the service role (booking_expenses has no
  //    staff-facing policy for an RLS-scoped read to use). ───────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: expenses, error: expErr } = await admin
    .from("booking_expenses")
    .select("id, type, amount, notes, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true });
  if (expErr) return json({ error: "Could not load expenses." }, 500);

  return json({ ok: true, expenses: expenses ?? [] });
}
