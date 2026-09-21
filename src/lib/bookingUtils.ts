import type { DbQuoteRequest } from "@/lib/database.types";
import type { BookingPrefill } from "@/components/AddBookingModal";

// Minimum gap required between two jobs assigned to the same driver on the
// same day, to allow for drive time / handover between transfers.
export const CLASH_BUFFER_MINUTES = 90;

export function timeToMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

// Maps a Booking Brain quote request onto the New Transfer form fields.
// Anything without a direct field on the booking (passengers, luggage,
// return trip, contact method) is folded into the notes for the operator
// to review.
export function quoteToPrefill(quote: DbQuoteRequest): BookingPrefill {
  // The quote form only ever collects a plain pickup + drop-off (no separate
  // airport field is set on quote_requests in practice) -- carry those
  // straight over as literal text. Which side is the airport gets detected
  // from the text itself when the operator turns this into a booking, the
  // same way AddBookingModal / the Dispatch board's BookingModal do.
  const pickup = quote.pickup_location ?? quote.airport ?? undefined;
  const dropoff = quote.destination ?? undefined;

  const noteParts: string[] = [];
  if (quote.passengers) noteParts.push(`${quote.passengers} passenger${quote.passengers !== 1 ? "s" : ""}`);
  if (quote.luggage) noteParts.push(`Luggage: ${quote.luggage}`);
  if (quote.return_required) {
    const parts = ["Return trip requested"];
    if (quote.return_date) parts.push(`on ${quote.return_date}`);
    if (quote.return_time) parts.push(`at ${quote.return_time.slice(0, 5)}`);
    if (quote.return_pickup) parts.push(`from ${quote.return_pickup}`);
    if (quote.return_destination) parts.push(`to ${quote.return_destination}`);
    if (quote.return_airport) parts.push(`(airport: ${quote.return_airport})`);
    if (quote.return_flight_number) parts.push(`flight ${quote.return_flight_number}`);
    noteParts.push(parts.join(" "));
  }
  if (quote.contact_method) noteParts.push(`Contact via ${quote.contact_method}`);
  if (quote.notes) noteParts.push(quote.notes);

  const prefill: BookingPrefill = {
    customer_name: quote.customer_name,
    customer_phone: quote.phone,
  };
  if (quote.email) prefill.customer_email = quote.email;
  if (quote.pickup_date) prefill.travel_date = quote.pickup_date;
  if (quote.pickup_time) prefill.travel_time = quote.pickup_time.slice(0, 5);
  if (pickup) prefill.pickup = pickup;
  if (dropoff) prefill.dropoff = dropoff;
  if (quote.flight_number) prefill.flight_number = quote.flight_number;
  if (noteParts.length) prefill.notes = noteParts.join(" · ");

  return prefill;
}