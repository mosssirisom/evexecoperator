"use client";

import { useEffect, useRef } from "react";
import { Plane } from "lucide-react";
import { WEEKDAYS_SHORT, addDays, dayOfMonth, daySummary, longDay } from "@/lib/operator/calendarModel";
import { StatusMark } from "./BookingRow";

const MAX_MARKS = 5;
const MAX_ROWS = 3;

/**
 * A ledger-style month: hairline grid, one cell per day. Phones get a compact
 * cell (a mark per job, an alert dot, an airport glyph); from lg each cell
 * lists its first jobs by time. Arrow keys move the selected day.
 */
export default function MonthView({ weeks, monthKey, selected, today, byDate, onSelect, onOpenDay }) {
  const gridRef = useRef(null);
  const focusWanted = useRef(false);

  // After a keyboard move, put focus on the newly selected cell.
  useEffect(() => {
    if (!focusWanted.current) return;
    focusWanted.current = false;
    gridRef.current?.querySelector(`[data-day="${selected}"]`)?.focus();
  }, [selected]);

  const onKeyDown = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      focusWanted.current = true;
      onSelect(addDays(selected, step));
    } else if (e.key === "Enter" && e.target?.dataset?.day) {
      e.preventDefault();
      onOpenDay(e.target.dataset.day);
    }
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 pb-1.5">
        {WEEKDAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-[10.5px] font-semibold uppercase tracking-[0.1em] ${i > 4 ? "text-cal-faint" : "text-cal-muted"} px-1.5 lg:px-2`}>
            <span className="lg:hidden">{d.slice(0, 1)}</span>
            <span className="hidden lg:inline">{d}</span>
          </div>
        ))}
      </div>

      <div
        ref={gridRef}
        role="grid"
        aria-label="Month"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-px overflow-hidden rounded-[10px] border border-cal-line bg-cal-line"
      >
        {weeks.flat().map((key) => {
          const list = byDate.get(key) ?? [];
          const live = list.filter((b) => b.state !== "cancelled");
          const sum = daySummary(list);
          const inMonth = key.slice(0, 7) === monthKey.slice(0, 7);
          const isSel = key === selected;
          const isToday = key === today;
          const label = `${longDay(key)}${isToday ? ", today" : ""}: ${sum.total ? `${sum.total} transfer${sum.total === 1 ? "" : "s"}` : "no transfers"}${sum.driver ? `, ${sum.driver} need a driver` : ""}${sum.reply ? `, ${sum.reply} awaiting reply` : ""}`;

          return (
            <button
              key={key}
              type="button"
              role="gridcell"
              data-day={key}
              tabIndex={isSel ? 0 : -1}
              aria-selected={isSel}
              aria-label={label}
              onClick={() => onSelect(key)}
              onDoubleClick={() => onOpenDay(key)}
              className={`relative flex h-[60px] flex-col items-stretch p-1.5 text-left transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cal-brass sm:h-[72px] lg:h-[118px] lg:p-2 ${
                isSel ? "bg-cal-well" : inMonth ? "bg-cal-sheet hover:bg-cal-paper" : "bg-cal-paper/70 hover:bg-cal-paper"
              }`}
            >
              {isSel && <span aria-hidden className="pointer-events-none absolute inset-0 ring-[1.5px] ring-inset ring-cal-ink" />}

              <span className="flex items-start justify-between">
                <span
                  className={`relative text-[13px] font-semibold leading-none tabular-nums lg:text-[14px] ${
                    isToday ? "text-cal-brass-ink" : inMonth ? "text-cal-ink" : "text-cal-faint"
                  }`}
                >
                  {dayOfMonth(key)}
                  {isToday && <span aria-hidden className="absolute -bottom-[4px] left-0 h-[2px] w-full min-w-[10px] bg-cal-brass" />}
                </span>
                {sum.attention && <span aria-hidden className="mt-px h-[6px] w-[6px] rounded-full bg-cal-alert" />}
              </span>

              {/* Phone / tablet: marks */}
              {live.length > 0 && (
                <span className="mt-auto flex items-center gap-[3px] lg:hidden">
                  {live.slice(0, MAX_MARKS).map((b) => <StatusMark key={b.id} state={b.state} className="!h-[6px] !w-[6px]" />)}
                  {live.length > MAX_MARKS && <span className="text-[9px] font-semibold leading-none text-cal-muted">+{live.length - MAX_MARKS}</span>}
                  {sum.airport > 0 && <Plane aria-hidden className="ml-auto h-[10px] w-[10px] text-cal-muted" strokeWidth={2.25} />}
                </span>
              )}

              {/* Desktop: first jobs by time */}
              {live.length > 0 && (
                <span className="mt-2 hidden min-w-0 flex-col gap-[3px] lg:flex">
                  {live.slice(0, MAX_ROWS).map((b) => (
                    <span key={b.id} className="flex min-w-0 items-center gap-1.5 text-[11.5px] leading-tight">
                      <StatusMark state={b.state} className="!h-[6px] !w-[6px]" />
                      <span className="shrink-0 font-semibold tabular-nums text-cal-ink">{b.minutes == null ? "--:--" : b.time}</span>
                      <span className={`truncate ${b.attention ? "text-cal-alert" : "text-cal-ink2"}`}>{(b.customer || "").split(" ").slice(-1)[0]}</span>
                      {b.isAirport && <Plane aria-hidden className="ml-auto h-[10px] w-[10px] shrink-0 text-cal-faint" strokeWidth={2.25} />}
                    </span>
                  ))}
                  {live.length > MAX_ROWS && <span className="pl-3 text-[11px] font-medium text-cal-muted">+{live.length - MAX_ROWS} more</span>}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Legend />
    </div>
  );
}

function Legend() {
  const items = [
    ["assigned", "Driver assigned"],
    ["driver", "Needs driver"],
    ["reply", "Awaiting reply"],
    ["road", "On the road"],
    ["done", "Completed"],
  ];
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-cal-muted">
      {items.map(([s, l]) => (
        <span key={s} className="inline-flex items-center gap-1.5"><StatusMark state={s} />{l}</span>
      ))}
      <span className="inline-flex items-center gap-1.5"><span className="h-[6px] w-[6px] rounded-full bg-cal-alert" />Needs attention</span>
      <span className="inline-flex items-center gap-1.5"><Plane className="h-[11px] w-[11px]" strokeWidth={2.25} />Airport</span>
    </div>
  );
}
