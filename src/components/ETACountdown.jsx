import React, { useState, useEffect } from "react";

function compute(pickupTime) {
  if (!pickupTime) return null;
  const diff = new Date(pickupTime) - Date.now();
  const mins = Math.round(diff / 60_000);

  if (mins > 120) {
    const hrs = Math.floor(mins / 60);
    const m = mins % 60;
    return { label: `${hrs}h ${m}m`, color: "text-slate-400" };
  }
  if (mins > 30) return { label: `in ${mins}m`, color: "text-emerald-400" };
  if (mins > 10) return { label: `in ${mins}m`, color: "text-amber-400" };
  if (mins > 0)  return { label: `in ${mins}m`, color: "text-red-400 font-semibold", urgent: true };
  if (mins > -60) return { label: `${Math.abs(mins)}m ago`, color: "text-red-300" };
  return { label: `${Math.abs(Math.floor(Math.abs(mins) / 60))}h ago`, color: "text-slate-600" };
}

export default function ETACountdown({ pickupTime, className = "" }) {
  const [state, setState] = useState(() => compute(pickupTime));

  useEffect(() => {
    if (!pickupTime) return;
    setState(compute(pickupTime));
    const id = setInterval(() => setState(compute(pickupTime)), 30_000);
    return () => clearInterval(id);
  }, [pickupTime]);

  if (!state) return <span className="text-slate-600">—</span>;

  return (
    <span className={`${state.color} ${className} text-xs tabular-nums`}>
      {state.urgent && <span className="mr-1">⚡</span>}
      {state.label}
    </span>
  );
}
