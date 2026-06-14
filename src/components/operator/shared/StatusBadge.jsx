"use client";

import { driverStatusMeta } from "@/lib/operator/driverExtras";

const COLOR_CLASSES = {
  emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  blue: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  red: "border-red-400/30 bg-red-400/10 text-red-300",
  rose: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  slate: "border-white/10 bg-white/5 text-slate-300",
  mutedRed: "border-white/10 bg-white/5 text-red-400/80",
};

const DOT_CLASSES = {
  emerald: "bg-emerald-400",
  amber: "bg-amber-400",
  blue: "bg-blue-400",
  violet: "bg-violet-400",
  red: "bg-red-400",
  rose: "bg-rose-400",
  slate: "bg-slate-400",
  mutedRed: "bg-red-400/60",
};

const BOOKING_STATUS_META = {
  "Unassigned": { label: "Unassigned", color: "rose" },
  "Unassigned / Missed Call Recovery": { label: "Missed Call", color: "red" },
  "Dispatched": { label: "Assigned", color: "amber" },
  "En Route": { label: "En Route", color: "blue" },
  "Passenger On Board": { label: "Passenger On Board", color: "violet" },
  "Completed": { label: "Completed", color: "slate" },
  "Cancelled": { label: "Cancelled", color: "mutedRed" },
};

const PAYMENT_STATUS_META = {
  "Paid": { label: "Paid", color: "emerald" },
  "Unpaid": { label: "Unpaid", color: "red" },
  "Invoiced": { label: "Invoiced", color: "blue" },
};

const LEAD_STATUS_META = {
  "New enquiry": { label: "New enquiry", color: "amber" },
  "Awaiting confirmation": { label: "Awaiting confirmation", color: "blue" },
  "Contacted": { label: "Contacted", color: "slate" },
  "Quoted": { label: "Quoted", color: "violet" },
  "Confirmed": { label: "Confirmed", color: "emerald" },
};

function metaFor(kind, status) {
  switch (kind) {
    case "payment":
      return PAYMENT_STATUS_META[status] ?? { label: status ?? "—", color: "slate" };
    case "driver":
      return driverStatusMeta(status);
    case "lead":
      return LEAD_STATUS_META[status] ?? { label: status ?? "—", color: "slate" };
    default:
      return BOOKING_STATUS_META[status] ?? { label: status ?? "—", color: "slate" };
  }
}

export default function StatusBadge({ status, kind = "booking", size = "md", className = "" }) {
  const { label, color } = metaFor(kind, status);
  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide ${COLOR_CLASSES[color] ?? COLOR_CLASSES.slate} ${sizeClasses} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[color] ?? DOT_CLASSES.slate}`} />
      {label}
    </span>
  );
}
