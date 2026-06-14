// Canonical operator-facing driver status set and display metadata.
// Legacy values ("Available soon", "En route", "Passenger onboard", "Off duty")
// are mapped onto the new set so existing records keep rendering correctly.

export const DRIVER_STATUS_OPTIONS = [
  "Available",
  "Assigned",
  "En Route",
  "Passenger On Board",
  "Break",
  "Off Duty",
];

const STATUS_META = {
  "Available": { label: "Available", color: "emerald" },
  "Assigned": { label: "Assigned", color: "amber" },
  "En Route": { label: "En Route", color: "blue" },
  "Passenger On Board": { label: "Passenger On Board", color: "violet" },
  "Break": { label: "Break", color: "slate" },
  "Off Duty": { label: "Off Duty", color: "slate" },
  // Legacy aliases
  "Available soon": { label: "Assigned", color: "amber" },
  "En route": { label: "En Route", color: "blue" },
  "Passenger onboard": { label: "Passenger On Board", color: "violet" },
  "Off duty": { label: "Off Duty", color: "slate" },
};

export function driverStatusMeta(status) {
  return STATUS_META[status] ?? { label: status || "Unknown", color: "slate" };
}

const ACTIVE_BOOKING_STATUSES = ["Dispatched", "En Route", "Passenger On Board"];

/**
 * Derives a driver's current and next job from the live bookings list.
 * TODO(backend): once jobs are persisted with explicit ordering this can be
 * replaced with a dedicated query instead of a client-side scan.
 */
export function getDriverJobs(driverId, bookings) {
  const jobs = bookings
    .filter((b) => b.driverId === driverId && ACTIVE_BOOKING_STATUSES.includes(b.status))
    .sort((a, b) => new Date(a.pickupTime || 0) - new Date(b.pickupTime || 0));

  const current =
    jobs.find((b) => b.status === "En Route" || b.status === "Passenger On Board") ?? jobs[0] ?? null;
  const next = jobs.find((b) => b.id !== current?.id) ?? null;

  return { current, next };
}
