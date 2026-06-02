import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Phone, Mail, Plane, MapPin, Clock, Car, PoundSterling,
  User, AlertTriangle, FileText, ChevronDown, Check, Edit3,
} from "lucide-react";
import { bookingStatusColor } from "../lib/statusColor";
import ETACountdown from "./ETACountdown";

const STATUSES = [
  "Unassigned", "Dispatched", "En Route",
  "Passenger On Board", "Completed", "Cancelled",
  "Unassigned / Missed Call Recovery",
];

function Row({ icon: Icon, label, value, muted }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">{label}</p>
        <p className={`mt-0.5 text-sm ${muted ? "text-slate-400" : "text-white"}`}>{value}</p>
      </div>
    </div>
  );
}

function StatusPicker({ currentStatus, onUpdate }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 ${bookingStatusColor(currentStatus)}`}
      >
        {currentStatus}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { onUpdate(s); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs transition hover:bg-white/5 ${
                s === currentStatus ? "opacity-40 cursor-default" : "text-slate-300"
              }`}
              disabled={s === currentStatus}
            >
              {s === currentStatus && <Check className="h-3 w-3" />}
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DriverPicker({ currentDriverId, drivers, onAssign }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = drivers.find((d) => d.id === currentDriverId);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300"
      >
        <Car className="h-3 w-3" />
        {current?.name ?? "Unassigned"}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-52 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl">
          <button
            onClick={() => { onAssign(null); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-500 transition hover:bg-white/5"
          >
            Unassigned
          </button>
          {drivers.map((d) => (
            <button
              key={d.id}
              onClick={() => { onAssign(d.id); setOpen(false); }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-xs transition hover:bg-white/5 ${
                d.id === currentDriverId ? "text-amber-300" : "text-slate-300"
              }`}
            >
              <span>{d.name}</span>
              <span className="text-slate-600">{d.status}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookingDetailDrawer({
  booking,
  drivers = [],
  onClose,
  onUpdateStatus,
  onAssignDriver,
  onUpdateNotes,
  onTogglePriority,
}) {
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef(null);

  // Sync notes when booking changes
  useEffect(() => {
    setNotes(booking?.notes ?? "");
    setEditingNotes(false);
  }, [booking?.id, booking?.notes]);

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  const saveNotes = useCallback(async () => {
    setSaving(true);
    try {
      await onUpdateNotes?.(booking.id, notes);
      setEditingNotes(false);
    } finally {
      setSaving(false);
    }
  }, [booking?.id, notes, onUpdateNotes]);

  if (!booking) return null;

  const isActive = ["Dispatched", "En Route", "Passenger On Board"].includes(booking.status);

  // Sanitise phone before use in href attributes — reject anything that isn't
  // a recognisable phone string to prevent javascript: injection.
  const rawPhone = booking.phone?.trim() ?? "";
  const phoneHref = rawPhone && /^[+\d][\d\s\-().]{4,}$/.test(rawPhone)
    ? `tel:${rawPhone.replace(/\s/g, "")}`
    : null;
  const waDigits = rawPhone.replace(/\D/g, "");
  const waHref = waDigits.length >= 7 && waDigits.length <= 15
    ? `https://wa.me/${waDigits}`
    : null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" aria-hidden="true" />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-booking-title"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/5 bg-[#070D1F] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 px-6 py-5">
          <div>
            <p className="font-mono text-xs text-slate-500">{booking.id}</p>
            <h2 id="drawer-booking-title" className="mt-1 text-xl font-semibold text-white">{booking.customer}</h2>
            <div className="mt-2 flex items-center gap-2">
              {booking.priority && (
                <span className="rounded-full border border-red-400/30 bg-red-400/10 px-2 py-0.5 text-[10px] font-medium text-red-300">
                  ⚡ Priority
                </span>
              )}
              <StatusPicker
                currentStatus={booking.status}
                onUpdate={(s) => onUpdateStatus?.(booking.id, s)}
              />
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ETA banner for active jobs */}
        {isActive && booking.pickupTime && (
          <div className="border-b border-white/5 bg-amber-400/[0.04] px-6 py-3">
            <p className="text-xs text-slate-500">Pickup</p>
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-semibold text-white">{booking.time}</span>
              <ETACountdown pickupTime={booking.pickupTime} className="text-sm" />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 space-y-6 px-6 py-6">
          {/* Contact */}
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-amber-400">Contact</p>
            <div className="space-y-3">
              {booking.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 flex-shrink-0 text-slate-600" />
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Phone</p>
                    <div className="flex items-center gap-2">
                      <p className="mt-0.5 text-sm text-white">{booking.phone}</p>
                      {phoneHref && (
                        <a
                          href={phoneHref}
                          className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300 transition hover:bg-emerald-400/20"
                        >
                          Call
                        </a>
                      )}
                      {waHref && (
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300 transition hover:bg-emerald-400/20"
                        >
                          WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {booking.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 flex-shrink-0 text-slate-600" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Email</p>
                    <a
                      href={`mailto:${booking.email}`}
                      className="mt-0.5 text-sm text-blue-300 hover:underline"
                    >
                      {booking.email}
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Journey */}
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-amber-400">Journey</p>
            <div className="space-y-3">
              <Row icon={MapPin} label="Route" value={booking.route} />
              <Row icon={Plane} label="Flight" value={booking.flight !== "—" ? booking.flight : null} />
              <Row icon={Clock} label="Pickup time" value={
                booking.pickupTime
                  ? new Date(booking.pickupTime).toLocaleString("en-GB", {
                      weekday: "short", day: "numeric", month: "short",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : booking.time !== "—" ? booking.time : null
              } />
              <Row icon={PoundSterling} label="Price" value={booking.price} />
            </div>
          </div>

          {/* Driver */}
          <div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-amber-400">Driver</p>
            <DriverPicker
              currentDriverId={booking.driverId}
              drivers={drivers}
              onAssign={(dId) => onAssignDriver?.(booking.id, dId)}
            />
          </div>

          {/* Notes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-400">Notes</p>
              {!editingNotes && (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1 text-[10px] text-slate-500 transition hover:text-amber-300"
                >
                  <Edit3 className="h-3 w-3" />
                  Edit
                </button>
              )}
            </div>
            {editingNotes ? (
              <div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes…"
                  className="w-full rounded-2xl border border-amber-400/20 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 resize-none"
                  autoFocus
                />
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={saveNotes}
                    disabled={saving}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={() => { setNotes(booking.notes ?? ""); setEditingNotes(false); }}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 transition hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-sm ${notes ? "text-slate-300" : "text-slate-600 italic"}`}>
                {notes || "No notes added"}
              </p>
            )}
          </div>

          {/* Meta */}
          <div className="border-t border-white/5 pt-4 text-xs text-slate-600 space-y-1">
            {booking.createdAt && (
              <p>Created {new Date(booking.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            )}
            {booking.updatedAt && (
              <p>Updated {new Date(booking.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-white/5 px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => onTogglePriority?.(booking.id)}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
              booking.priority
                ? "border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                : "border-white/10 text-slate-400 hover:border-amber-400/20 hover:text-amber-300"
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            {booking.priority ? "Remove Priority" : "Mark Priority"}
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-slate-400 transition hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </>
  );
}
