"use client";

import type { BookingStatus } from "@/lib/database.types";

interface Props {
  status: BookingStatus;
  compact?: boolean;
}

const CONFIG: Record<BookingStatus, { label: string; dot: string; bg: string; text: string; pulse: boolean }> = {
  "Unassigned":                    { label: "Unassigned",         dot: "bg-slate-400",   bg: "bg-slate-800/60",   text: "text-slate-300",  pulse: false },
  "Unassigned / Missed Call Recovery": { label: "Missed Call",   dot: "bg-orange-400",  bg: "bg-orange-900/30",  text: "text-orange-300", pulse: true  },
  "Dispatched":                    { label: "Dispatched",         dot: "bg-amber-400",   bg: "bg-amber-900/30",   text: "text-amber-300",  pulse: true  },
  "En Route":                      { label: "En Route",           dot: "bg-blue-400",    bg: "bg-blue-900/30",    text: "text-blue-300",   pulse: true  },
  "Arrived":                       { label: "Arrived",            dot: "bg-cyan-400",    bg: "bg-cyan-900/30",    text: "text-cyan-300",   pulse: true  },
  "Passenger On Board":            { label: "Passenger On Board", dot: "bg-purple-400",  bg: "bg-purple-900/30",  text: "text-purple-300", pulse: true  },
  "Completed":                     { label: "Completed",          dot: "bg-emerald-400", bg: "bg-emerald-900/30", text: "text-emerald-300",pulse: false },
  "Cancelled":                     { label: "Cancelled",          dot: "bg-red-500",     bg: "bg-red-900/30",     text: "text-red-400",    pulse: false },
  "CRITICAL_UNALLOCATED":          { label: "Critical",           dot: "bg-red-500",     bg: "bg-red-900/40",     text: "text-red-300",    pulse: true  },
};

export default function StatusBadge({ status, compact = false }: Props) {
  const { label, dot, bg, text, pulse } = CONFIG[status] ?? CONFIG["Unassigned"];

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        {label}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${bg} ${text} border border-white/5`}>
      <span className={`w-2 h-2 rounded-full ${dot} ${pulse ? "animate-gold-pulse" : ""}`} />
      {label}
    </span>
  );
}