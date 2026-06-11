import React, { useEffect, useRef, useState } from "react";
import { Send, CheckCircle2, Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { dispatchJobToDriverApp } from "../lib/driverApp";
import { driverJobUrl } from "../lib/portals";

const DISPATCHABLE_STATUSES = ["Unassigned", "Unassigned / Missed Call Recovery"];

export default function DispatchButton({ booking, driverName, currentStatus, onDispatched }) {
  const [state, setState] = useState("idle"); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const handleDispatch = async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      await dispatchJobToDriverApp({
        bookingRef: booking.id,
        customer: booking.customer,
        route: booking.route,
        flight: booking.flight,
        pickupTime: booking.time,
        price: booking.price,
        driver: driverName,
        status: booking.status,
      });
      setState("success");
      timerRef.current = setTimeout(() => setState("idle"), 3000);
      if (DISPATCHABLE_STATUSES.includes(currentStatus)) {
        onDispatched?.();
      }
    } catch (e) {
      setErrMsg(e.message);
      setState("error");
      timerRef.current = setTimeout(() => setState("idle"), 4000);
    }
  };

  if (state === "success") {
    return (
      <div className="flex items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sent
        </span>
        <a
          href={driverJobUrl(booking.id)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2 py-2 text-xs text-slate-400 transition hover:text-amber-300"
          title="View job on driver portal"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  if (state === "error") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300"
        title={errMsg}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Failed
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={handleDispatch}
        disabled={state === "loading"}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs font-medium text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-60"
      >
        {state === "loading" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {state === "loading" ? "Sending…" : "Dispatch"}
      </button>
      <a
        href={driverJobUrl(booking.id)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-2 py-2 text-xs text-slate-600 transition hover:border-white/20 hover:text-slate-400"
        title="View job on driver portal"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
