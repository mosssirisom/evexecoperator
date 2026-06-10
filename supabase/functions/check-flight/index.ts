/**
 * Supabase Edge Function: check-flight
 *
 * Returns live flight status via AeroDataBox. Falls back to a structured
 * "not configured" response if the API key is absent.
 *
 * Required Supabase secret:
 *   AERODATABOX_API_KEY  - from rapidapi.com/aedbx-aerodatabox
 *
 * Request body (JSON):
 *   { flightNumber: string, date?: string }   // date: "YYYY-MM-DD", default today
 *
 * Response:
 *   {
 *     ok: boolean,
 *     configured: boolean,
 *     flight?: {
 *       number: string,
 *       status: "Unknown" | "EnRoute" | "Landed" | "Cancelled" | "Diverted",
 *       scheduledArrival: string | null,   // ISO
 *       estimatedArrival: string | null,   // ISO — null if on time
 *       delayMins: number,
 *       origin: string,
 *       destination: string,
 *       airline: string,
 *     },
 *     reason?: string,
 *   }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { flightNumber, date } = await req.json();

    if (!flightNumber) {
      return new Response(
        JSON.stringify({ ok: false, configured: false, reason: "Missing flightNumber" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("AERODATABOX_API_KEY");

    if (!apiKey) {
      // Return a useful mock so the UI degrades gracefully
      return new Response(
        JSON.stringify({
          ok: true,
          configured: false,
          flight: {
            number: flightNumber,
            status: "Unknown",
            scheduledArrival: null,
            estimatedArrival: null,
            delayMins: 0,
            origin: "—",
            destination: "—",
            airline: "—",
          },
          reason: "AERODATABOX_API_KEY not configured",
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const flightDate = date ?? todayUTC();
    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(flightNumber)}/${flightDate}`;

    const aeroRes = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
    });

    if (aeroRes.status === 404) {
      return new Response(
        JSON.stringify({ ok: false, configured: true, reason: "Flight not found" }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    if (!aeroRes.ok) {
      const text = await aeroRes.text().catch(() => "");
      return new Response(
        JSON.stringify({ ok: false, configured: true, reason: `AeroDataBox ${aeroRes.status}: ${text}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const raw = await aeroRes.json();
    const f = Array.isArray(raw) ? raw[0] : raw;

    const scheduledArrival = f?.arrival?.scheduledTime?.utc ?? null;
    const estimatedArrival = f?.arrival?.revisedTime?.utc ?? null;

    let delayMins = 0;
    if (scheduledArrival && estimatedArrival) {
      delayMins = Math.round(
        (new Date(estimatedArrival).getTime() - new Date(scheduledArrival).getTime()) / 60_000
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        configured: true,
        flight: {
          number: f?.number ?? flightNumber,
          status: f?.status ?? "Unknown",
          scheduledArrival,
          estimatedArrival: delayMins > 0 ? estimatedArrival : null,
          delayMins: Math.max(0, delayMins),
          origin: f?.departure?.airport?.iata ?? "—",
          destination: f?.arrival?.airport?.iata ?? "—",
          airline: f?.airline?.name ?? "—",
        },
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[check-flight] Error:", err);
    return new Response(
      JSON.stringify({ ok: false, configured: false, reason: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
