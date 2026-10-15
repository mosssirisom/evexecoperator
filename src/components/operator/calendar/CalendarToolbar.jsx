"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";

const VIEW_LABELS = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "list", label: "List" },
];

const iconBtn =
  "flex h-9 w-9 items-center justify-center rounded-md text-cal-ink2 transition-colors hover:bg-cal-well focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-brass";

export default function CalendarToolbar({
  period, view, onView, onPrev, onNext, onToday, onTodayDisabled,
  query, onQuery, driver, onDriver, drivers, showCancelled, onShowCancelled,
}) {
  const [searchOpen, setSearchOpen] = useState(Boolean(query));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchRef = useRef(null);
  const filterRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Close the filter panel on outside click / Escape.
  useEffect(() => {
    if (!filtersOpen) return;
    const onDown = (e) => { if (!filterRef.current?.contains(e.target)) setFiltersOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setFiltersOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [filtersOpen]);

  const filtersActive = driver !== "all" || showCancelled;

  return (
    <div className="border-b border-cal-line">
      {/* Title + navigation */}
      <div className="flex items-end justify-between gap-3 pb-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-cal-brass-ink">{period.subtitle}</p>
          <h2 className="mt-1 truncate font-display text-[28px] font-medium leading-[1.05] tracking-[-0.01em] text-cal-ink tabular-nums lg:text-[34px]" aria-live="polite">
            {period.title}
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onToday}
            disabled={onTodayDisabled}
            className="mr-1 h-9 rounded-md border border-cal-rule px-3 text-[13px] font-semibold text-cal-ink transition-colors hover:bg-cal-well disabled:border-cal-line disabled:text-cal-faint disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-brass"
          >
            Today
          </button>
          <button type="button" onClick={onPrev} className={iconBtn} aria-label={`Previous ${view === "list" ? "month" : view}`}>
            <ChevronLeft className="h-[18px] w-[18px]" />
          </button>
          <button type="button" onClick={onNext} className={iconBtn} aria-label={`Next ${view === "list" ? "month" : view}`}>
            <ChevronRight className="h-[18px] w-[18px]" />
          </button>
        </div>
      </div>

      {/* Views + search + filters */}
      <div className="flex items-center justify-between gap-2">
        <div role="tablist" aria-label="Calendar view" className="-mb-px flex">
          {VIEW_LABELS.map((v, i) => {
            const active = v.key === view;
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onView(v.key)}
                className={`relative h-10 px-3 text-[13.5px] font-semibold transition-colors first:pl-0 focus-visible:outline-none focus-visible:text-cal-brass-ink ${
                  active ? "text-cal-ink" : "text-cal-muted hover:text-cal-ink"
                }`}
              >
                {v.label}
                {active && <span aria-hidden className={`absolute bottom-0 right-3 h-[2px] bg-cal-ink ${i === 0 ? "left-0" : "left-3"}`} />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 pb-1">
          {/* Search: always visible from sm, a toggle on phones */}
          <label className={`${searchOpen ? "flex" : "hidden"} h-9 items-center gap-2 rounded-md border border-cal-rule bg-cal-sheet px-2.5 sm:flex sm:w-56`}>
            <Search className="h-4 w-4 shrink-0 text-cal-muted" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { onQuery(""); setSearchOpen(false); } }}
              placeholder="Name, ref, flight, driver"
              aria-label="Search the calendar"
              className="w-28 min-w-0 bg-transparent text-[13px] text-cal-ink outline-none placeholder:text-cal-faint sm:w-full"
            />
            {query && (
              <button type="button" onClick={() => onQuery("")} aria-label="Clear search" className="text-cal-muted hover:text-cal-ink">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          {!searchOpen && (
            <button type="button" onClick={() => setSearchOpen(true)} className={`${iconBtn} sm:hidden`} aria-label="Search">
              <Search className="h-[17px] w-[17px]" />
            </button>
          )}

          <div ref={filterRef} className="relative">
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              aria-label="Filters"
              className={`${iconBtn} relative ${filtersOpen ? "bg-cal-well" : ""}`}
            >
              <SlidersHorizontal className="h-[17px] w-[17px]" />
              {filtersActive && <span aria-hidden className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-cal-brass" />}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-[10px] border border-cal-rule bg-cal-sheet p-3 shadow-[0_12px_32px_-12px_rgba(20,24,33,0.25)]">
                <label className="block text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cal-muted" htmlFor="cal-driver">Driver</label>
                <select
                  id="cal-driver"
                  value={driver}
                  onChange={(e) => onDriver(e.target.value)}
                  className="mt-1.5 h-9 w-full rounded-md border border-cal-rule bg-cal-sheet px-2 text-[13px] text-cal-ink outline-none focus:border-cal-brass"
                >
                  <option value="all">All drivers</option>
                  <option value="none">No driver assigned</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}{d.kind === "partner" ? " (partner)" : ""}</option>
                  ))}
                </select>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-cal-ink">
                  <input type="checkbox" checked={showCancelled} onChange={(e) => onShowCancelled(e.target.checked)} className="h-4 w-4 accent-[#141821]" />
                  Show cancelled bookings
                </label>
                {filtersActive && (
                  <button type="button" onClick={() => { onDriver("all"); onShowCancelled(false); }} className="mt-3 text-[12px] font-semibold text-cal-brass-ink hover:underline">
                    Reset filters
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
