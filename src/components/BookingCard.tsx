"use client";

import { useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Clock, MapPin, Phone, ChevronDown, ChevronUp, MessageSquare, Plane, Star, AlertCircle, Bell, AlertTriangle, Trash2 } from "lucide-react";
import type { DbBooking, DbDriver, BookingStatus } from "@/lib/database.types";
import { STATUS_NEXT_PRIMARY, STATUS_NEXT_LABEL } from "@/lib/database.types";
import type { BookingNotificationStatus } from "@/hooks/useNotifications";
import StatusBadge from "./StatusBadge";
import DriverDropdown from "./DriverDropdown";

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  confirmation: "Confirmation",
  reminder_24h: "24h reminder",
  received: "Booking received",
};

interface Props {
  booking: DbBooking;
  drivers: DbDriver[];
  notification?: BookingNotificationStatus;
  unavailableDriverIds?: Set<string>;
  onStatusChange: (ref: string, status: BookingStatus) => void;
  onDriverAssign:  (ref: string, driverId: string | null) => void;
  onDangerAction?: (booking: DbBooking) => void;
}

export default function BookingCard({ booking, drivers, notification, unavailableDriverIds, onStatusChange, onDriverAssign, onDangerAction }: Props) {
  const [expanded, setExpanded] = useState(false);

  const time      = booking.travel_time?.slice(0, 5) ?? "—";
  const nextStatus = STATUS_NEXT_PRIMARY[booking.status];
  const nextLabel  = STATUS_NEXT_LABEL[booking.status];

  const from = booking.airport ?? booking.direction ?? "—";
  const to   = booking.dropoff_address ?? "—";
  const route = `${from.split(",")[0]} → ${to.split(",")[0]}`;

  return (
    <div className="rounded-2xl border border-white/8 bg-navy-800 shadow-card overflow-hidden transition-all hover:border-gold/20">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gold/70" />
          <span className="text-xl font-bold text-slate-100 tracking-tight">{time}</span>
          {booking.priority && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-400 bg-amber-900/30 px-1.5 py-0.5 rounded-full">
              <Star size={8} fill="currentColor" /> Priority
            </span>
          )}
          {notification && notification.failedCount > 0 && (
            <AlertTriangle size={12} className="text-red-400" aria-label="Notification failed to send" />
          )}
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="px-4 pt-3 pb-4 space-y-3">
        <div>
          <p className="font-semibold text-slate-100 text-sm leading-tight">{booking.customer_name}</p>
          <div className="flex items-start gap-1.5 mt-1">
            <MapPin size={12} className="text-gold/60 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-400 leading-relaxed">{route}</p>
          </div>
        </div>

        {booking.flight_number && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-900/20 border border-white/5">
            <Plane size={12} className="text-blue-400 shrink-0 -rotate-45" />
            <span className="text-xs font-bold text-blue-300 tracking-wide">{booking.flight_number}</span>
            {booking.direction && (
              <span className="text-xs text-slate-500 ml-auto">{booking.direction}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {booking.payment_status ?? "Unpaid"}
          </span>
          <span className="text-sm font-semibold text-gold">
            {booking.quoted_price != null ? `£${Number(booking.quoted_price).toFixed(0)}` : "TBC"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 w-16 shrink-0">Driver</span>
          <DriverDropdown
            drivers={drivers}
            selectedDriverId={booking.driver_id}
            unavailableDriverIds={unavailableDriverIds}
            onAssign={(id) => onDriverAssign(booking.ref, id)}
            disabled={booking.status === "Completed" || booking.status === "Cancelled"}
          />
          {booking.driver_id && unavailableDriverIds?.has(booking.driver_id) && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-400" title="Driver has marked this day unavailable">
              <AlertTriangle size={11} /> Unavailable
            </span>
          )}
        </div>

        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? "Less details" : "More details"}
        </button>

        {expanded && (
          <div className="space-y-2 pt-1 border-t border-white/5 slide-up">
            {booking.airport && <DetailRow label="From" value={booking.airport} />}
            {booking.dropoff_address && <DetailRow label="To" value={booking.dropoff_address} />}
            {booking.travel_date && (
              <DetailRow label="Date" value={new Date(booking.travel_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} />
            )}
            {booking.customer_phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={11} className="text-gold/60 shrink-0" />
                <span className="text-xs text-slate-400">{booking.customer_phone}</span>
              </div>
            )}
            {booking.notes && (
              <div className="flex items-start gap-1.5">
                <MessageSquare size={11} className="text-gold/60 shrink-0 mt-0.5" />
                <span className="text-xs text-slate-400 italic">{booking.notes}</span>
              </div>
            )}
            {booking.customer_email && <DetailRow label="Email" value={booking.customer_email} />}
            {notification?.lastSent && (
              <div className="flex items-center gap-1.5">
                <Bell size={11} className="text-gold/60 shrink-0" />
                <span className="text-xs text-slate-400">
                  {NOTIFICATION_TYPE_LABELS[notification.lastSent.type] ?? notification.lastSent.type} sent{" "}
                  {formatDistanceToNow(parseISO(notification.lastSent.sent_at), { addSuffix: true })}
                </span>
              </div>
            )}
            {notification && notification.pendingCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-900/20 px-3 py-1.5 rounded-lg">
                <Bell size={11} />
                {notification.pendingCount} notification{notification.pendingCount === 1 ? "" : "s"} pending
              </div>
            )}
            {notification && notification.failedCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-300 bg-red-900/20 px-3 py-1.5 rounded-lg">
                <AlertTriangle size={11} />
                {notification.failedCount} notification{notification.failedCount === 1 ? "" : "s"} failed to send
              </div>
            )}
            {onDangerAction && (
              <button
                type="button"
                onClick={() => onDangerAction(booking)}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                <Trash2 size={13} /> Remove job
              </button>
            )}
          </div>
        )}

        {nextStatus && nextLabel && (
          <button
            onClick={() => onStatusChange(booking.ref, nextStatus)}
            className="w-full mt-1 py-2 rounded-xl text-xs font-semibold bg-gold/10 text-gold border border-gold/25 hover:bg-gold/20 hover:border-gold/40 active:scale-[0.98] transition-all"
          >
            {nextLabel}
          </button>
        )}

        {booking.status === "Unassigned / Missed Call Recovery" && (
          <div className="flex items-center gap-1.5 text-xs text-orange-300 bg-orange-900/20 px-3 py-1.5 rounded-lg">
            <AlertCircle size={11} />
            Missed call recovery — assign driver urgently
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-slate-600 w-16 shrink-0 mt-0.5">{label}</span>
      <span className="text-xs text-slate-400 leading-relaxed">{value}</span>
    </div>
  );
}
