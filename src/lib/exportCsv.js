import { formatLondonDateText, formatLondonTimeText, toLondonTimeText } from "./londonTime";

/**
 * Converts an array of booking objects into a CSV string and triggers a browser download.
 */
export function exportBookingsCsv(bookings, filename = "evexec-bookings.csv") {
  const headers = [
    "Ref", "Customer", "Phone", "Email",
    "Route", "Airport", "Destination", "Direction",
    "Flight", "Pickup Date", "Pickup Time",
    "Driver", "Price", "Status", "Payment Status",
    "Priority", "Notes",
  ];

  const escape = (val) => {
    if (val == null || val === "—") return "";
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const rows = bookings.map((b) => {
    // Prefer the verbatim travel_date/travel_time text (safe -- never
    // re-derived through a timezone-sensitive Date object) over pickupTime,
    // which is only a fallback for rows that predate travel_date/travel_time.
    const pickupDate = b.travelDate ? formatLondonDateText(b.travelDate) : (b.pickupTime ? new Date(b.pickupTime).toLocaleDateString("en-GB", { timeZone: "Europe/London" }) : "");
    const pickupTimeText = b.travelTime ? formatLondonTimeText(b.travelTime) : (b.pickupTime ? toLondonTimeText(b.pickupTime) : "");
    return [
      b.id,
      b.customer,
      b.phone ?? "",
      b.email ?? "",
      b.route,
      b.airport ?? "",
      b.destination ?? "",
      b.direction ?? "",
      b.flight !== "—" ? b.flight : "",
      pickupDate,
      pickupTimeText,
      b.driver,
      b.price,
      b.status,
      b.paymentStatus ?? "Unpaid",
      b.priority ? "Yes" : "No",
      b.notes ?? "",
    ].map(escape);
  });

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
