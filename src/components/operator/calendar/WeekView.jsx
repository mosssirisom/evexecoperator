"use client";

import { AlertTriangle, Plane } from "lucide-react";
import { eachDay, shortDay, weekdayShort, dayOfMonth } from "@/lib/operator/calendarModel";
import BookingRow, { StatusMark } from "./BookingRow";

const shortPlace = (v) => (v ? String(v).split(",")[0].trim() : "—");

/**
 * Seven days by pickup time. From lg: seven columns of compact job tiles.
 * On phones: the days stacked as schedule rows, empty days folded to one line.
 */
export default function WeekView({ period, today, selected, byDate, selectedId, onOpen, onSelectDay, onOpenDay }) {
  const days = eachDay(period.start, period.end);

  return (
    <div className="mt-4">
      {/* Desktop columns */}
      <div className="hidden overflow-hidden rounded-[10px] border border-cal-line bg-cal-line lg:grid lg:grid-cols-7 lg:gap-px">
        {days.map((key) => {
          const list = byDate.get(key) ?? [];
          const live = list.filter((b) => b.state !== "cancelled");
          const isToday = key === today;
          const isSel = key === selected;
          return (
            <section key={key} className={`flex min-h-[420px] min-w-0 flex-col ${isSel ? "bg-cal-well/60" : "bg-cal-sheet"}`}>
              <button
                type="button"
                onClick={() => onSelectDay(key)}
                onDoubleClick={() => onOpenDay(key)}
                className="flex items-baseline justify-between border-b border-cal-line px-2.5 pb-2 pt-2.5 text-left hover:bg-cal-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cal-brass"
              >
                <span>
                  <span className={`block text-[10.5px] font-semibold uppercase tracking-[0.1em] ${isToday ? "text-cal-brass-ink" : "text-cal-muted"}`}>{weekdayShort(key)}{isToday ? " · Today" : ""}</span>
                  <span className={`font-display text-[22px] leading-none tabular-nums ${isToday ? "text-cal-brass-ink" : "text-cal-ink"}`}>{dayOfMonth(key)}</span>
                </span>
                <span className="text-[11px] tabular-nums text-cal-muted">{live.length || ""}</span>
              </button>
              <div className="flex flex-1 flex-col gap-px bg-cal-line">
                {list.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => onOpen(b)}
                    aria-current={b.id === selectedId ? "true" : undefined}
                    className={`relative px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cal-brass ${
                      b.id === selectedId ? "bg-cal-well" : "bg-cal-sheet hover:bg-cal-paper"
                    } ${b.state === "cancelled" ? "opacity-55" : ""}`}
                  >
                    {b.id === selectedId && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-cal-ink" />}
                    <span className="flex items-center gap-1.5">
                      <StatusMark state={b.state} />
                      <span className="text-[13px] font-semibold tabular-nums text-cal-ink">{b.minutes == null ? "--:--" : b.time}</span>
                      {b.isAirport && <Plane aria-hidden className="h-3 w-3 text-cal-faint" strokeWidth={2.25} />}
                      {b.attention && <AlertTriangle aria-label="Needs attention" className={`ml-auto h-3 w-3 ${b.flags.some((f) => f.tone === "alert") ? "text-cal-alert" : "text-cal-brass"}`} strokeWidth={2.25} />}
                    </span>
                    <span className="mt-1 block truncate text-[12.5px] font-medium text-cal-ink">{b.customer}</span>
                    <span className="block truncate text-[11.5px] text-cal-ink2">→ {shortPlace(b.dropoffAddress || b.airport)}</span>
                    <span className={`block truncate text-[11px] ${b.driverId ? "text-cal-muted" : "font-medium text-cal-alert"}`}>{b.driverId ? b.driver : "No driver"}</span>
                  </button>
                ))}
                <div className="flex-1 bg-cal-sheet" />
              </div>
            </section>
          );
        })}
      </div>

      {/* Phone: stacked days */}
      <div className="lg:hidden">
        {days.map((key) => {
          const list = byDate.get(key) ?? [];
          const live = list.filter((b) => b.state !== "cancelled");
          const isToday = key === today;
          return (
            <section key={key} className="border-b border-cal-line">
              <button
                type="button"
                onClick={() => onOpenDay(key)}
                className="flex w-full items-baseline justify-between py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cal-brass"
              >
                <span className={`text-[13px] font-semibold ${isToday ? "text-cal-brass-ink" : list.length ? "text-cal-ink" : "text-cal-faint"}`}>
                  {shortDay(key)}{isToday ? " · Today" : ""}
                </span>
                <span className="text-[12px] tabular-nums text-cal-muted">
                  {live.length ? `${live.length} transfer${live.length === 1 ? "" : "s"}` : "None"}
                </span>
              </button>
              {list.length > 0 && (
                <ol className="-mx-3 divide-y divide-cal-line border-t border-cal-line pb-1">
                  {list.map((b) => <li key={b.id}><BookingRow b={b} onOpen={onOpen} selected={b.id === selectedId} /></li>)}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
