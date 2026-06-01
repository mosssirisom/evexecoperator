import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, CheckCircle2, Loader2, MapPin, AlertCircle, XCircle } from "lucide-react";
import { bookingStatusColor } from "../lib/statusColor";

const STATUSES = [
  { value: "Dispatched", icon: Loader2, spin: true, color: "text-amber-300" },
  { value: "En Route", icon: MapPin, spin: false, color: "text-blue-300" },
  { value: "Passenger On Board", icon: CheckCircle2, spin: false, color: "text-emerald-300" },
  { value: "Completed", icon: CheckCircle2, spin: false, color: "text-slate-400" },
  { value: "Cancelled", icon: XCircle, spin: false, color: "text-red-400" },
];


export default function StatusActionMenu({ bookingId, currentStatus, onUpdate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (value) => {
    setOpen(false);
    onUpdate?.(bookingId, value);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-80 ${bookingStatusColor(currentStatus)}`}
      >
        {currentStatus === "Unassigned / Missed Call Recovery" ? "Missed Call" : currentStatus}
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl">
          {STATUSES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.value}
                onClick={() => handleSelect(s.value)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs transition hover:bg-white/5 ${
                  s.value === currentStatus ? "opacity-50 cursor-default" : ""
                } ${s.color}`}
                disabled={s.value === currentStatus}
              >
                <Icon className={`h-3.5 w-3.5 ${s.spin ? "animate-spin" : ""}`} />
                {s.value}
                {s.value === currentStatus && (
                  <span className="ml-auto text-slate-600">current</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
