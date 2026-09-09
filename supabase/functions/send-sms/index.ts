/**
 * Supabase Edge Function: send-sms
 *
 * Sends an SMS via Twilio. Falls back to a structured "not configured" response
 * if secrets are absent so the UI can degrade gracefully.
 *
 * Required Supabase secrets (set via `supabase secrets set`):
 *   TWILIO_ACCOUNT_SID   - e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN    - your Twilio auth token
 *   TWILIO_FROM_NUMBER   - your Twilio phone number, e.g. +441234567890
 *
 * Request body (JSON):
 *   { to: string, message: string, bookingRef?: string }
 *
 * Response:
 *   { ok: boolean, sid?: string, reason?: string }
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const { to, message, bookingRef } = await req.json();

    if (!to || !message) {
      return new Response(
        JSON.stringify({ ok: false, reason: "Missing required fields: to, message" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken  = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from       = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!accountSid || !authToken || !from) {
      console.log("[send-sms] Twilio not configured — returning mock success");
      return new Response(
        JSON.stringify({ ok: false, reason: "Twilio not configured", mockSid: `MOCK-${bookingRef ?? "SMS"}` }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const body = new URLSearchParams({ To: to, From: from, Body: message });
    const url  = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const twilioRes = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
      },
      body: body.toString(),
    });

    const data = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("[send-sms] Twilio error:", data);
      return new Response(
        JSON.stringify({ ok: false, reason: data.message ?? "Twilio API error" }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, sid: data.sid }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[send-sms] Unexpected error:", err);
    return new Response(
      JSON.stringify({ ok: false, reason: err.message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
