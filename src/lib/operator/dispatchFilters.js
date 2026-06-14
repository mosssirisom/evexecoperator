// Quick filter pills shown above the Live Dispatch Centre views.
export const QUICK_FILTERS = ["Today", "Tomorrow", "This Week", "Airport", "Unassigned", "Completed"];

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function matchesQuickFilter(booking, filter) {
  if (!filter) return true;

  switch (filter) {
    case "Unassigned":
      return booking.status?.startsWith("Unassigned") ?? false;
    case "Completed":
      return booking.status === "Completed";
    case "Airport":
      // "Airport" runs = collections from the airport, as opposed to drop-offs at it.
      return booking.direction === "Airport → Destination";
    case "Today":
    case "Tomorrow":
    case "This Week": {
      if (!booking.pickupTime) return false;
      const pickup = startOfDay(booking.pickupTime);
      const today = startOfDay(Date.now());
      if (filter === "Today") return pickup === today;
      if (filter === "Tomorrow") return pickup === today + DAY_MS;
      return pickup >= today && pickup < today + 7 * DAY_MS;
    }
    default:
      return true;
  }
}

// Kanban board columns for the Live Dispatch Centre board view, mapped onto
// the canonical BOOKING_STATUSES from lib/operator/validation.
export const BOARD_COLUMNS = [
  { key: "unassigned", title: "Unassigned", statuses: ["Unassigned", "Unassigned / Missed Call Recovery"], accent: "rose" },
  { key: "assigned", title: "Assigned", statuses: ["Dispatched"], accent: "amber" },
  { key: "en-route", title: "Driver En Route", statuses: ["En Route"], accent: "blue" },
  { key: "on-board", title: "Passenger On Board", statuses: ["Passenger On Board"], accent: "violet" },
  { key: "completed", title: "Completed", statuses: ["Completed"], accent: "slate" },
  { key: "cancelled", title: "Cancelled", statuses: ["Cancelled"], accent: "mutedRed" },
];

export const ACCENT_DOT_CLASSES = {
  rose: "bg-rose-400",
  amber: "bg-amber-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
  slate: "bg-slate-400",
  mutedRed: "bg-red-400/60",
};
