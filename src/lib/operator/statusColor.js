export function bookingStatusColor(status) {
  switch (status) {
    case "Dispatched":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "En Route":
      return "border-blue-400/30 bg-blue-400/10 text-blue-300";
    case "Arrived":
      return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
    case "Passenger On Board":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Completed":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    case "Unassigned":
    case "Unassigned / Missed Call Recovery":
      return "border-amber-400/30 bg-amber-400/10 text-amber-300";
    case "CRITICAL_UNALLOCATED":
      return "border-red-500/40 bg-red-500/15 text-red-300";
    case "Cancelled":
      return "border-red-400/30 bg-red-400/10 text-red-300";
    default:
      return "border-red-400/30 bg-red-400/10 text-red-300";
  }
}
