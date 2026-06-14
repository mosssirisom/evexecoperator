"use client";

import { useState } from "react";
import { Clock, MapPin, Plane, Car, Star, GripVertical, Users, Briefcase, RefreshCw } from "lucide-react";
import StatusBadge from "../shared/StatusBadge";
import ETACountdown from "../ETACountdown";
import QuickActionsMenu from "./QuickActionsMenu";
import { airportCode } from "@/lib/operator/bookingExtras";

/**
 * Kanban card for the Live Dispatch Centre board view. Shows every field
 * required at a glance — pickup time, customer, route, airport, flight,
 * driver, status and payment status — plus the quick actions menu.
 */
export default function DispatchCard({ booking, drivers, onViewDetails, onEdit, onAssignDriver }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        // TODO(dispatch-dnd): full drag-and-drop column reassignment is not
        // implemented yet. Once it is, BoardColumn's onDrop should read this
        // payload and call onUpdateStatus(booking.id, targetColumn.statuses[0]).
        e.dataTransfer.setData("application/x-booking-id", booking.id);
        e.dataTransfer.effectAllowed = "move";
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
      className={`card group relative flex flex-col gap-2.5 rounded-2xl p-3.5 transition hover:border-amber-400/20 ${
        dragging ? "opacity-40" : ""
      } ${booking.priority ? "border-red-500/20 bg-red-500/[0.04]" : ""}`}
    >
      {/* Time + ETA + quick actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {/* Drag handle — TODO(dispatch-dnd): wire up real drag-and-drop reordering */}
          <GripVertical className="h-3.5 w-3.5 flex-shrink-0 cursor-grab text-slate-700" aria-hidden="true" />
          <Clock className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
          <span className="text-sm font-semibold text-white">{booking.time}</span>
          {booking.pickupTime && <ETACountdown pickupTime={booking.pickupTime} className="text-[10px]" />}
        </div>
        <div className="flex items-center gap-1">
          {booking.priority && <Star className="h-3.5 w-3.5 flex-shrink-0 fill-amber-400 text-amber-400" />}
          <QuickActionsMenu
            booking={booking}
            drivers={drivers}
            onViewDetails={onViewDetails}
            onEdit={onEdit}
            onAssignDriver={onAssignDriver}
          />
        </div>
      </div>

      {/* Customer + route */}
      <button onClick={() => onViewDetails?.(booking)} className="text-left">
        <p className="truncate text-sm font-semibold text-white">{booking.customer}</p>
        <div className="mt-1 flex items-start gap-1.5 text-xs text-slate-400">
          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          <span className="line-clamp-2">{booking.route}</span>
        </div>
      </button>

      {/* Airport + flight + pax/bags + return journey */}
      {(booking.airport || booking.flight !== "—" || booking.passengers || booking.bags || booking.returnJourney) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
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
          {booking.passengers != null && (
            <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-0.5">
              <Users className="h-3 w-3" />
              {booking.passengers}
            </span>
          )}
          {booking.bags && (
            <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-0.5">
              <Briefcase className="h-3 w-3" />
              {booking.bags}
            </span>
          )}
          {booking.returnJourney && (
            <span className="flex items-center gap-1 rounded-full border border-blue-400/20 bg-blue-400/10 px-2 py-0.5 font-medium text-blue-300">
              <RefreshCw className="h-3 w-3" />
              Return
            </span>
          )}
        </div>
      )}

      {/* Driver + price */}
      <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2 text-xs">
        <span className={`flex min-w-0 items-center gap-1.5 truncate ${booking.driverId ? "text-slate-300" : "font-medium text-amber-400/80"}`}>
          <Car className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          {booking.driver}
        </span>
        <span className="flex-shrink-0 font-semibold text-amber-300">{booking.price}</span>
      </div>

      {/* Status + payment */}
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={booking.status} size="sm" />
        <StatusBadge status={booking.paymentStatus} kind="payment" size="sm" />
      </div>
    </div>
  );
}
