"use client";

import { Map as MapIcon, Car, MapPin, Navigation } from "lucide-react";
import StatusBadge from "../shared/StatusBadge";
import EmptyState from "../shared/EmptyState";
import ETACountdown from "../ETACountdown";

const ACTIVE_STATUSES = ["Dispatched", "En Route", "Passenger On Board"];

/**
 * Placeholder for the Live Dispatch Centre map view. Live driver tracking
 * isn't wired up yet, so this renders a map-shaped placeholder plus a list
 * of currently active transfers so dispatchers still have something useful
 * to scan.
 *
 * TODO(dispatch-map): replace the placeholder with a live map (Mapbox GL or
 * Google Maps) that shows:
 *  - real-time driver positions, sourced from a driver location feed
 *    (see backend requirements — drivers currently have no location data)
 *  - route polylines for "En Route" and "Passenger On Board" jobs
 *  - pickup/drop-off pins for every active transfer, click-through to
 *    BookingDetailDrawer via onViewDetails
 */
export default function MapView({ bookings, loading, onViewDetails }) {
  const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-12 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
          <MapIcon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Map View</p>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            Live driver locations and routes will appear here once map tracking is connected.
            Active transfers are listed below in the meantime.
          </p>
        </div>
      </div>

      {loading && bookings.length === 0 ? (
        <div className="flex flex-col gap-2.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-[4.5rem] animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
          ))}
        </div>
      ) : active.length === 0 ? (
        <EmptyState
          icon={Navigation}
          title="No active transfers"
          message="Jobs that are dispatched, en route, or have a passenger on board will appear here."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {active.map((b) => (
            <ActiveTransferRow key={b.id} booking={b} onViewDetails={onViewDetails} />
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveTransferRow({ booking, onViewDetails }) {
  return (
    <button
      onClick={() => onViewDetails?.(booking)}
      className="card flex items-center gap-3 rounded-2xl p-3.5 text-left transition hover:border-amber-400/20 sm:p-4"
    >
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
        <Car className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-white">{booking.customer}</p>
          {booking.pickupTime && <ETACountdown pickupTime={booking.pickupTime} className="text-[10px]" />}
        </div>
        <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          <span className="line-clamp-1">{booking.route}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
        <StatusBadge status={booking.status} size="sm" />
        <span className="text-xs text-slate-500">{booking.driver}</span>
      </div>
    </button>
  );
}
