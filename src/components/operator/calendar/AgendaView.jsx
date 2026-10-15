"use client";

import { eachDay, longDay } from "@/lib/operator/calendarModel";
import BookingRow from "./BookingRow";

/** The period's days that have work, as one continuous schedule. */
export default function AgendaView({ period, today, byDate, selectedId, onOpen, onOpenDay, emptyText }) {
  const days = eachDay(period.start, period.end).filter((k) => (byDate.get(k) ?? []).length > 0);

  if (!days.length) {
    return <p className="py-14 text-center text-[13px] text-cal-muted">{emptyText}</p>;
  }

  return (
    <div className="mt-2">
      {days.map((key) => {
        const list = byDate.get(key);
        const live = list.filter((b) => b.state !== "cancelled").length;
        return (
          <section key={key}>
            <button
              type="button"
              onClick={() => onOpenDay(key)}
              className="sticky top-0 z-[1] flex w-full items-baseline justify-between border-b border-cal-line bg-cal-paper/95 py-2.5 text-left backdrop-blur-[2px] focus-visible:outline-none"
            >
              <span className={`font-display text-[16px] font-medium ${key === today ? "text-cal-brass-ink" : key < today ? "text-cal-muted" : "text-cal-ink"}`}>
                {longDay(key)}{key === today ? " · Today" : ""}
              </span>
              <span className="text-[12px] tabular-nums text-cal-muted">{live} transfer{live === 1 ? "" : "s"}</span>
            </button>
            <ol className="-mx-3 divide-y divide-cal-line pb-2">
              {list.map((b) => <li key={b.id}><BookingRow b={b} onOpen={onOpen} selected={b.id === selectedId} /></li>)}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
