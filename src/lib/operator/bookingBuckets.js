// Shared definitions of where a booking stands, used by Today and the
// Bookings board so both screens agree on what "needs a driver" etc. means.
// Works on the shaped bookings from hooks/operator/useBookings.

export const DONE_STATUSES = ["Completed", "Cancelled", "No Show"];
export const ON_ROAD_STATUSES = ["En Route", "Arrived", "Passenger On Board"];

/** A website request the operator hasn't accepted or declined yet. */
export const awaitingReply = (b) =>
  b.source === "website" && !b.operatorResponse && !["Cancelled", "Completed"].includes(b.status);

/** Still to do and no driver on it. */
export const needsDriver = (b) =>
  !DONE_STATUSES.includes(b.status) &&
  !awaitingReply(b) &&
  (b.status === "Unassigned" || b.status === "Unassigned / Missed Call Recovery" || !b.driverId);

/** Finished but not paid (cash jobs are settled with the driver, not here). */
export const unpaidCompleted = (b) =>
  b.status === "Completed" && b.paymentStatus !== "Paid" && b.paymentMethod !== "Cash";

/** Minutes from `now` until pickup (negative once passed); null if no time. */
export function minutesUntil(b, now = Date.now()) {
  if (!b.pickupTime) return null;
  const t = new Date(b.pickupTime).getTime();
  return Number.isNaN(t) ? null : Math.round((t - now) / 60000);
}

/** Board column for a booking, or null if it doesn't belong on the board. */
export function boardColumn(b, today) {
  if (b.status === "Cancelled") return null;
  if (awaitingReply(b)) return "reply";
  if (ON_ROAD_STATUSES.includes(b.status)) return "road";
  if (DONE_STATUSES.includes(b.status)) return b.travelDate === today ? "done" : null;
  if (needsDriver(b)) return "driver";
  return "assigned";
}
