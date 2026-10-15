"use client";

import { ArrowRight, Plus } from "lucide-react";
import { driverLoad, formatGap, gapBefore, longDay } from "@/lib/operator/calendarModel";
import BookingRow from "./BookingRow";

const GAP_SHOWN_FROM = 120; // minutes between pickups worth pointing out

/**
 * One day's transfers as a working schedule. `compact` is the version under
 * the month grid and in the side panel; the full Day view adds the drivers'
 * load and the free time between pickups.
 */
export default function DaySchedule({ date, today, bookings, selectedId, onOpen, onNewBooking, onOpenDay, compact = false, hideTitle = false, emptyHint }) {
  const live = bookings.filter((b) => b.state !== "cancelled");
  const timed = bookings.filter((b) => b.minutes != null);
  const untimed = bookings.filter((b) => b.minutes == null);
  const isToday = date === today;
  const isPastDay = date < today;
  const load = compact ? null : driverLoad(bookings);
  const first = live.find((b) => b.minutes != null);
  const last = [...live].reverse().find((b) => b.minutes != null);

  return (
    <section aria-label={longDay(date)}>
      <header className="border-b border-cal-line pb-2.5">
        {!hideTitle && (
          <h3 className="font-display text-[19px] font-medium leading-tight text-cal-ink">{longDay(date)}</h3>
        )}
        <div className="mt-0.5 flex items-baseline justify-between gap-3">
          <p className="min-w-0 truncate text-[12px] text-cal-muted">
            {isToday && <span className="font-semibold text-cal-brass-ink">Today · </span>}
            {live.length ? `${live.length} transfer${live.length === 1 ? "" : "s"}` : "No transfers"}
            {first && last && first !== last && ` · ${first.time}–${last.time}`}
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {onOpenDay && (
              <button type="button" onClick={() => onOpenDay(date)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-cal-ink hover:text-cal-brass-ink">
                Day view <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            {!isPastDay && (
              <button type="button" onClick={() => onNewBooking(date)} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-cal-brass-ink hover:underline" aria-label={`New booking on ${longDay(date)}`}>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> New
              </button>
            )}
          </div>
        </div>
      </header>

      {load && (load.drivers.length > 0 || load.unassigned > 0) && (
        <div className="flex gap-4 overflow-x-auto border-b border-cal-line py-2.5 [scrollbar-width:none]">
          {load.unassigned > 0 && (
            <span className="shrink-0 text-[12px]"><span className="font-semibold tabular-nums text-cal-alert">{load.unassigned}</span> <span className="text-cal-alert">without driver</span></span>
          )}
          {load.drivers.map((d) => (
            <span key={d.id} className="shrink-0 text-[12px] text-cal-ink2">
              <span className="font-semibold text-cal-ink">{d.name}</span> <span className="tabular-nums text-cal-muted">{d.jobs.length} · {d.jobs.map((j) => j.time).filter((t) => t !== "—").join(", ")}</span>
            </span>
          ))}
        </div>
      )}

      {bookings.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-cal-muted">{emptyHint ?? (isPastDay ? "Nothing was booked for this day." : "Nothing booked yet.")}</p>
      ) : (
        <ol className="divide-y divide-cal-line">
          {timed.map((b, i) => {
            const gap = compact ? null : gapBefore(timed, i);
            return (
              <li key={b.id}>
                {gap != null && gap >= GAP_SHOWN_FROM && (
                  <p className="flex items-center gap-2 px-3 py-1.5 text-[11px] text-cal-faint">
                    <span className="h-px flex-1 bg-cal-line" />
                    {formatGap(gap)} between pickups
                    <span className="h-px flex-1 bg-cal-line" />
                  </p>
                )}
                <BookingRow b={b} onOpen={onOpen} selected={b.id === selectedId} />
              </li>
            );
          })}
          {untimed.length > 0 && (
            <li>
              <p className="px-3 pb-1 pt-3 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cal-muted">No pickup time</p>
              <ol className="divide-y divide-cal-line">
                {untimed.map((b) => <li key={b.id}><BookingRow b={b} onOpen={onOpen} selected={b.id === selectedId} /></li>)}
              </ol>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}
