import { NextRequest, NextResponse } from "next/server";

// Bridges to evexec's /api/notifications/confirm so operator-created
// bookings get the exact same SMS+email+push confirmation website bookings
// get (sendConfirmations), instead of a separate SMS-only "is booked" text.
// Keeps the Twilio/Resend/web-push credentials and sending logic in one
// place (evexec) rather than duplicating that whole stack here.
export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json();
    if (!bookingId) {
      return NextResponse.json({ error: "bookingId required" }, { status: 400 });
    }

    const websiteUrl = process.env.WEBSITE_API_URL || process.env.NEXT_PUBLIC_WEBSITE_URL;
    const secret = process.env.OPERATOR_ACTION_SECRET;
    if (!websiteUrl || !secret) {
      // Not configured — degrade silently rather than blocking booking
      // creation. The operator's own status-update SMS still goes out.
      return NextResponse.json({ ok: false, skipped: "not configured" }, { status: 200 });
    }

    const res = await fetch(`${websiteUrl}/api/notifications/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-operator-secret": secret },
      body: JSON.stringify({ booking_id: bookingId }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json({ error: `Website notify failed: ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
