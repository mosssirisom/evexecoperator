"use client";

import {
  Clock,
  MapPin,
  Plane,
  User,
  Car,
  MessageCircle,
  UserPlus,
  PlayCircle,
  Pencil,
  Users,
  Briefcase,
  Baby,
  Star,
  StickyNote,
  Hash,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import ETACountdown from "../ETACountdown";
import { getBookingExtras } from "@/lib/operator/bookingExtras";
import { whatsAppLink } from "@/lib/operator/contact";

/**
 * Compact-but-complete transfer card used on the Command Centre, Dispatch
 * board and anywhere else a booking needs to be scanned at a glance.
 *
 * `compact` trims the meta row, payment row and notes for tight spaces
 * (e.g. the "Next 5 Transfers" list) while keeping the header, route and
 * primary action.
 */
export default function TransferCard({ booking, compact = false, onOpenDetail, onStartDispatch, className = "" }) {
  const extras = getBookingExtras(booking);
  const isUnassigned = booking.status?.startsWith("Unassigned");
  const canStartDispatch = !!booking.driverId && booking.status === "Dispatched";
  const wa = whatsAppLink(booking.phone);

  return (
    <div className={`card flex flex-col rounded-2xl p-4 transition hover:border-amber-400/20 ${className}`}>
      {/* Time + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-400" />
          <span className="text-base font-semibold text-white">{booking.time}</span>
          {booking.pickupTime && <ETACountdown pickupTime={booking.pickupTime} />}
        </div>
        <div className="flex items-center gap-2">
          {booking.priority && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />}
          <StatusBadge status={booking.status} size="sm" />
        </div>
      </div>

      {/* Route */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-start gap-2 text-sm font-medium text-white">
          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="line-clamp-1">{booking.route}</span>
        </div>
        {(booking.flight !== "—" || extras.terminal) && (
          <div className="flex items-start gap-2 text-sm text-slate-400">
            <Plane className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" />
            <span className="line-clamp-1">
              {booking.flight !== "—" && `Flight ${booking.flight}`}
              {booking.flight !== "—" && extras.terminal && " · "}
              {extras.terminal}
            </span>
          </div>
        )}
      </div>

      {/* Meta chips */}
      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-1">
            <Hash className="h-3 w-3" />
            {booking.id}
          </span>
          <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-1">
            <Users className="h-3 w-3" />
            {extras.passengers} pax
          </span>
          <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-1">
            <Briefcase className="h-3 w-3" />
            {extras.bags} bags
          </span>
          {extras.childSeats > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.02] px-2 py-1">
              <Baby className="h-3 w-3" />
              {extras.childSeats} seat
            </span>
          )}
          {extras.meetAndGreet && (
            <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 font-medium text-amber-300">
              Meet &amp; Greet
            </span>
          )}
        </div>
      )}

      {/* Customer / driver */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/5 pt-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-white">
          <User className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className="truncate">{booking.customer}</span>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Car className="h-4 w-4 flex-shrink-0 text-slate-500" />
          <span className={`truncate ${booking.driverId ? "text-white" : "text-rose-300"}`}>{booking.driver}</span>
        </div>
      </div>

      {/* Price / payment */}
      {!compact && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-amber-300">{booking.price}</span>
          <StatusBadge status={booking.paymentStatus} kind="payment" size="sm" />
        </div>
      )}

      {/* Notes */}
      {!compact && booking.notes && (
        <div className="mt-2 flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
          <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
          <span className="line-clamp-2">{booking.notes}</span>
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-white/5 pt-3">
        {isUnassigned ? (
          <button
            onClick={() => onOpenDetail?.(booking)}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Assign Driver
          </button>
        ) : canStartDispatch ? (
          <button
            onClick={() => onStartDispatch?.(booking)}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            Start Dispatch
          </button>
        ) : (
          <button
            onClick={() => onOpenDetail?.(booking)}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-semibold text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300"
          >
            View Details
          </button>
        )}
        <a
          href={wa ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          title="Message customer on WhatsApp"
          aria-disabled={!wa}
          onClick={(e) => { if (!wa) e.preventDefault(); }}
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 transition ${
            wa ? "text-slate-400 hover:border-amber-400/20 hover:text-amber-300" : "text-slate-700 cursor-not-allowed"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
        </a>
        <button
          onClick={() => onOpenDetail?.(booking)}
          title="Edit booking"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:border-amber-400/20 hover:text-amber-300"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
