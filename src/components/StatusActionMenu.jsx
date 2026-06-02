import React, { useRef, useState, useEffect } from "react";
import { ChevronDown, CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
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
  const [pendingStatus, setPendingStatus] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setConfirmCancel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isUpdating = pendingStatus !== null;

  const handleSelect = async (value) => {
    if (value === currentStatus) return;
    if (value === "Cancelled") {
      setConfirmCancel(true);
      return;
    }
    setOpen(false);
    setPendingStatus(value);
    try {
      await onUpdate?.(bookingId, value);
    } finally {
      setPendingStatus(null);
    }
  };

  const handleConfirmCancel = async () => {
    setOpen(false);
    setConfirmCancel(false);
    setPendingStatus("Cancelled");
    try {
      await onUpdate?.(bookingId, "Cancelled");
    } finally {
      setPendingStatus(null);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { if (!isUpdating) setOpen(!open); }}
        disabled={isUpdating}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition hover:opacity-80 disabled:cursor-wait ${bookingStatusColor(currentStatus)}`}
      >
        {isUpdating ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            {pendingStatus === "Unassigned / Missed Call Recovery"
              ? "Updating…"
              : `${pendingStatus}…`}
          </>
        ) : (
          <>
            {currentStatus === "Unassigned / Missed Call Recovery" ? "Missed Call" : currentStatus}
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      {open && !isUpdating && (
        <div
          role="listbox"
          aria-label="Change booking status"
          className="absolute left-0 top-full z-50 mt-1 w-52 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl"
        >
          {confirmCancel ? (
            <div className="px-4 py-3">
              <p className="text-xs font-medium text-white">Cancel this booking?</p>
              <p className="mt-0.5 text-[10px] text-slate-500">This action cannot be undone.</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 rounded-xl bg-red-500/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/30"
                >
                  Yes, Cancel
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:text-white"
                >
                  Keep Job
                </button>
              </div>
            </div>
          ) : (
            STATUSES.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  role="option"
                  aria-selected={s.value === currentStatus}
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
            })
          )}
        </div>
      )}
    </div>
  );
}
