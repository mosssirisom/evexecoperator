// TODO(backend): The fields derived below are not yet columns on the
// `bookings` table. Until dedicated columns exist — terminal, passengers,
// bags, child_seats, meet_and_greet, pickup_buffer_minutes, job_source,
// lead_status, cancellation_reason, no_show, return_booking_ref,
// profit_estimate, dead_mileage_miles — this helper derives sensible
// display defaults from the data we do have, so the UI can demonstrate the
// full operator workflow end to end. Replace each derived value with the
// real column / calculation once the backend supports it.

const AIRPORT_TERMINALS = {
  "Manchester Airport (MAN)": "Terminal 1",
  "Liverpool Airport (LPL)": "Main Terminal",
  "Leeds Bradford Airport (LBA)": "Main Terminal",
  "Birmingham Airport (BHX)": "Terminal 1",
};

const KG_CO2_PER_TRANSFER = 7.3; // matches the estimate used on Analytics
const AVG_PROFIT_MARGIN = 0.35; // assumed margin until real cost data exists
const AVG_DEAD_MILEAGE_MILES = 6; // assumed empty-leg mileage per job

/**
 * Returns a stable pseudo-random number in [0, 1) derived from a string.
 * Keeps mocked values consistent across re-renders for the same booking.
 */
function seededRatio(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 1000) / 1000;
}

// Shortens "Manchester Airport (MAN)" to "MAN" for compact card badges,
// falling back to the full name if there's no bracketed code.
export function airportCode(airport) {
  if (!airport) return null;
  const match = airport.match(/\(([^)]+)\)/);
  return match ? match[1] : airport;
}

export function getBookingExtras(booking) {
  const seed = booking?.id ?? "";
  const ratio = seededRatio(seed);
  const isMissedCallOrigin = booking?.status === "Unassigned / Missed Call Recovery";
  const isUnassigned = booking?.status?.startsWith("Unassigned");
  // booking.price is a formatted string ("£45" or "TBC") — strip to a number.
  const price = parseFloat(String(booking?.price ?? "").replace(/[^0-9.]/g, "")) || 0;

  const terminal = AIRPORT_TERMINALS[booking?.airport] ?? null;
  const passengers = 1 + Math.floor(ratio * 4); // 1-4
  const bags = 1 + Math.floor(ratio * 3); // 1-3
  const childSeats = ratio > 0.8 ? 1 : 0;
  const meetAndGreet = ratio > 0.65 && booking?.direction === "Airport → Destination";
  const pickupBufferMinutes = booking?.direction === "Airport → Destination" ? 30 : 15;

  const jobSource = isMissedCallOrigin
    ? "Phone"
    : ratio > 0.85
      ? "Repeat customer"
      : ratio > 0.55
        ? "WhatsApp"
        : ratio > 0.3
          ? "Website"
          : "Manual";

  const leadStatus = isUnassigned
    ? isMissedCallOrigin
      ? "New enquiry"
      : "Awaiting confirmation"
    : null;

  const outstandingBalance = booking?.paymentStatus === "Paid" ? 0 : price;
  const profitEstimate = Math.max(0, Math.round(price * AVG_PROFIT_MARGIN * 100) / 100);
  const deadMileageMiles = AVG_DEAD_MILEAGE_MILES;
  const co2SavedKg = KG_CO2_PER_TRANSFER;

  const cancellationReason = booking?.status === "Cancelled" ? "Not specified" : null;
  const noShow = false;

  return {
    terminal,
    passengers,
    bags,
    childSeats,
    meetAndGreet,
    pickupBufferMinutes,
    jobSource,
    leadStatus,
    outstandingBalance,
    profitEstimate,
    deadMileageMiles,
    co2SavedKg,
    cancellationReason,
    noShow,
  };
}
