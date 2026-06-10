/**
 * Client-side callers for Supabase Edge Functions.
 * All functions degrade gracefully when the function isn't deployed or the
 * underlying API key (Twilio / AeroDataBox / Stripe) isn't configured —
 * they return { ok: false, configured: false, reason: "..." } rather than
 * throwing, so the UI can show a friendly message instead of crashing.
 */

import { supabase, isConfigured } from "./supabase";

async function invoke(fnName, body) {
  if (!isConfigured || !supabase) {
    return { ok: false, configured: false, reason: "Supabase not configured" };
  }
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body });
    if (error) return { ok: false, configured: false, reason: error.message };
    return data;
  } catch (err) {
    return { ok: false, configured: false, reason: err.message };
  }
}

/**
 * Send an SMS via Twilio.
 * @param {{ to: string, message: string, bookingRef?: string }} opts
 */
export function sendSms(opts) {
  return invoke("send-sms", opts);
}

/**
 * Check live flight status via AeroDataBox.
 * @param {{ flightNumber: string, date?: string }} opts
 */
export function checkFlight(opts) {
  return invoke("check-flight", opts);
}

/**
 * Create a Stripe Payment Link.
 * @param {{ bookingRef: string, amount: number, description: string, customerEmail?: string }} opts
 * amount is in pence (e.g. 16000 = £160.00)
 */
export function createPaymentLink(opts) {
  return invoke("create-payment-link", opts);
}

/** Builds a booking confirmation SMS message. */
export function bookingConfirmationSms(booking) {
  const time = booking.pickupTime
    ? new Date(booking.pickupTime).toLocaleString("en-GB", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      })
    : "TBC";
  return (
    `Hi ${booking.customer.split(" ")[0]}, your EV Exec transfer is confirmed.\n` +
    `📍 ${booking.route}\n` +
    `🕐 ${time}\n` +
    `🚗 Driver: ${booking.driver !== "Unassigned" ? booking.driver : "Being arranged"}\n` +
    `Ref: ${booking.id}\n` +
    `Questions? Call us anytime.`
  );
}

/** Builds a missed-call recovery SMS with a booking enquiry link. */
export function missedCallRecoverySms() {
  return (
    `Hi, sorry we missed your call! We're EV Exec — premium electric airport transfers.\n` +
    `To check availability or get a quote, reply to this message or visit evexec.co.uk.\n` +
    `We'll call you back shortly.`
  );
}
