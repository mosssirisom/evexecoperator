"use client";

import { AlertTriangle, Plane } from "lucide-react";
import { STATE_STYLE } from "./tokens";

/** A small square status mark. Hollow = waiting on the office. */
export function StatusMark({ state, className = "" }) {
  const s = STATE_STYLE[state] ?? STATE_STYLE.assigned;
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-[2px] ${s.mark} ${className}`} />;
}

export function StateLabel({ state }) {
  const s = STATE_STYLE[state] ?? STATE_STYLE.assigned;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${s.text}`}>
      <StatusMark state={state} />
      {s.label}
    </span>
  );
}

export function FlagLine({ flags, max = 2 }) {
  if (!flags?.length) return null;
  const shown = flags.slice(0, max);
  return (
    <ul className="mt-1.5 space-y-0.5">
      {shown.map((f) => (
        <li key={f.code} className={`flex items-center gap-1.5 text-[12px] font-medium ${f.tone === "alert" ? "text-cal-alert" : "text-cal-brass-ink"}`}>
          <AlertTriangle className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
          {f.label}
        </li>
      ))}
      {flags.length > max && <li className="pl-[18px] text-[11px] text-cal-muted">+{flags.length - max} more</li>}
    </ul>
  );
}

const shortPlace = (v) => (v ? String(v).split(",")[0].trim() : null);

/**
 * One transfer as a schedule row: time, who, where, driver, fare, warnings.
 * `selected` draws the inspector focus; `dense` drops the route's second line.
 */
export default function BookingRow({ b, onOpen, selected = false, dense = false, showTime = true }) {
  const from = shortPlace(b.pickupLocation || b.airport || b.direction);
  const to = shortPlace(b.dropoffAddress || b.airport);
  const cancelled = b.state === "cancelled";
  const flight = b.flight && b.flight !== "—" ? b.flight : null;

  return (
    <button
      type="button"
      onClick={() => onOpen(b)}
      aria-current={selected ? "true" : undefined}
      className={`group relative flex w-full gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cal-brass ${
        selected ? "bg-cal-well" : "hover:bg-cal-paper"
      } ${cancelled ? "opacity-60" : ""}`}
    >
      {selected && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-cal-ink" />}
      {showTime && (
        <div className="w-12 shrink-0 pt-px">
          <p className={`text-[15px] font-semibold tabular-nums leading-none ${b.minutes == null ? "text-cal-faint" : "text-cal-ink"} ${cancelled ? "line-through" : ""}`}>
            {b.minutes == null ? "--:--" : b.time}
          </p>
          {b.isAirport && <Plane className="mt-1.5 h-3 w-3 text-cal-muted" strokeWidth={2} aria-label="Airport transfer" />}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <StatusMark state={b.state} className="relative -top-px" />
          <p className={`min-w-0 truncate text-[14px] font-semibold text-cal-ink ${cancelled ? "line-through" : ""}`}>{b.customer || "No name"}</p>
          <span className="ml-auto shrink-0 text-[13px] font-medium tabular-nums text-cal-ink2">{b.fare == null ? <span className="text-cal-faint">TBC</span> : `£${b.fare % 1 ? b.fare.toFixed(2) : b.fare}`}</span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-cal-ink2">
          {from ?? "—"} <span className="text-cal-faint">→</span> {to ?? "—"}
        </p>
        {!dense && (
          <p className="mt-0.5 flex min-w-0 items-center gap-1.5 truncate text-[12px] text-cal-muted">
            {b.driverId ? <span className="truncate">{b.driver}</span> : <span className="font-medium text-cal-alert">No driver</span>}
            {flight && <><span aria-hidden>·</span><span className="tabular-nums">{flight}</span></>}
            <span aria-hidden>·</span>
            <span className="tabular-nums">{b.id}</span>
          </p>
        )}
        <FlagLine flags={b.flags} max={dense ? 1 : 2} />
      </div>
    </button>
  );
}
