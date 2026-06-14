"use client";

import { Clock, MapPin, Plane, Car, Star } from "lucide-react";
import { CalendarClock } from "lucide-react";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import ETACountdown from "../ETACountdown";
import QuickActionsMenu from "./QuickActionsMenu";
import { airportCode } from "@/lib/operator/bookingExtras";

function dayKey(pickupTime) {
  return new Date(pickupTime).toDateString();
}

function dayHeading(key, todayKey, tomorrowKey, sample) {
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  return new Date(sample).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function RowSkeleton() {
  return (
    <div className="flex gap-3">
      <div className="h-9 w-14 flex-shrink-0 animate-pulse rounded-2xl bg-white/[0.04]" />
      <div className="h-20 flex-1 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
    </div>
  );
}

/**
 * Chronological timeline view of the Live Dispatch Centre. Groups bookings
 * with a pickup time by day (Today / Tomorrow / weekday) and renders each as
 * a connected row, richest first by pickup time.
 */
export default function TimelineView({ bookings, drivers, loading, onViewDetails, onEdit, onAssignDriver }) {
  if (loading && bookings.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => <RowSkeleton key={i} />)}
      </div>
    );
  }

  const withTime = bookings
    .filter((b) => b.pickupTime)
    .sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));

  if (withTime.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No scheduled pickups"
        message="Transfers with a pickup time will appear here in chronological order."
      />
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayKey = today.toDateString();
  const tomorrowKey = tomorrow.toDateString();

  const groups = [];
  for (const b of withTime) {
    const key = dayKey(b.pickupTime);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, items: [] };
      groups.push(group);
    }
    group.items.push(b);
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <section key={group.key}>
          <p className="mb-3 text-xs uppercase tracking-[0.28em] text-amber-400">
            {dayHeading(group.key, todayKey, tomorrowKey, group.items[0].pickupTime)}
          </p>
          <div className="flex flex-col gap-3">
            {group.items.map((b, i) => (
              <TimelineRow
                key={b.id}
                booking={b}
                drivers={drivers}
                last={i === group.items.length - 1}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onAssignDriver={onAssignDriver}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TimelineRow({ booking, drivers, last, onViewDetails, onEdit, onAssignDriver }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-9 min-w-[3.5rem] flex-shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 px-2 text-xs font-semibold text-amber-300">
          {booking.time}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-white/10" />}
      </div>

      <div
        className={`card group flex flex-1 flex-col gap-2.5 rounded-2xl p-3.5 transition hover:border-amber-400/20 sm:p-4 ${
          booking.priority ? "border-red-500/20 bg-red-500/[0.04]" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => onViewDetails?.(booking)} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              {booking.priority && <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />}
              <p className="truncate text-sm font-semibold text-white">{booking.customer}</p>
              {booking.pickupTime && <ETACountdown pickupTime={booking.pickupTime} className="text-[10px]" />}
            </div>
            <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-400">
              <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
              <span className="line-clamp-1">{booking.route}</span>
            </div>
          </button>
          <QuickActionsMenu
            booking={booking}
            drivers={drivers}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onAssignDriver={onAssignDriver}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          {booking.airport && (
            <span className="rounded-full border border-white/5 bg-white/[0.02] px-2 py-0.5 font-medium">
              {airportCode(booking.airport)}
            </span>
          )}
          {booking.flight !== "—" && (
            <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-0.5">
              <Plane className="h-3 w-3" />
              {booking.flight}
            </span>
          )}
          <span className={`flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-0.5 ${booking.driverId ? "" : "font-medium text-amber-400/80"}`}>
            <Car className="h-3 w-3" />
            {booking.driver}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={booking.status} size="sm" />
            <StatusBadge status={booking.paymentStatus} kind="payment" size="sm" />
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-amber-300">
            <Clock className="h-3 w-3 opacity-0" aria-hidden="true" />
            {booking.price}
          </span>
        </div>
      </div>
    </div>
  );
}
