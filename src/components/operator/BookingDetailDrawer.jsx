"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  X, Phone, Mail, Plane, MapPin, Clock, Car, PoundSterling,
  User, AlertTriangle, FileText, ChevronDown, Check, Edit3, Loader2, RefreshCw,
  CreditCard,
} from "lucide-react";
import { bookingStatusColor } from "@/lib/operator/statusColor";
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
  const [pending, setPending] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setConfirmCancel(false); } };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  const handleSelect = async (s) => {
    if (s === currentStatus) return;
    if (s === "Cancelled") { setConfirmCancel(true); return; }
    setOpen(false);
    setPending(s);
    try { await onUpdate(s); } finally { setPending(null); }
  };

  const handleConfirmCancel = async () => {
    setConfirmCancel(false);
    setOpen(false);
    setPending("Cancelled");
    try { await onUpdate("Cancelled"); } finally { setPending(null); }
  };

  const isUpdating = pending !== null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !isUpdating && setOpen(!open)}
        disabled={isUpdating}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-60 disabled:cursor-not-allowed ${bookingStatusColor(pending ?? currentStatus)}`}
      >
        {isUpdating ? (
          <><Loader2 className="h-3 w-3 animate-spin" />Updating…</>
        ) : (
          <>{pending ?? currentStatus}<ChevronDown className="h-3 w-3" /></>
        )}
      </button>
      {open && !isUpdating && (
        <div
          role="listbox"
          aria-label="Change booking status"
          className="absolute left-0 top-full z-[60] mt-1 w-60 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl"
        >
          {confirmCancel ? (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-300">Cancel this booking?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmCancel}
                  className="flex-1 rounded-xl bg-red-500/20 border border-red-500/30 px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/30"
                >
                  Yes, Cancel
                </button>
                <button
                  onClick={() => setConfirmCancel(false)}
                  className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:text-white"
                >
                  Keep Job
                </button>
              </div>
            </div>
          ) : (
            STATUSES.map((s) => (
              <button
                key={s}
                role="option"
                aria-selected={s === currentStatus}
                onClick={() => handleSelect(s)}
                className={`flex w-full items-center gap-2.5 px-4 py-3 text-xs transition hover:bg-white/5 ${
                  s === currentStatus ? "opacity-40 cursor-default" : "text-slate-300"
                }`}
                disabled={s === currentStatus}
              >
                {s === currentStatus && <Check className="h-3 w-3" />}
                {s}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function driverDot(status) {
  if (status === "Available") return "bg-emerald-400";
  if (status === "On Trip") return "bg-amber-400";
  return "bg-slate-600";
}

function DriverPicker({ currentDriverId, drivers, onAssign }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const ref = useRef(null);
  const current = drivers.find((d) => d.id === currentDriverId);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  const handleAssign = async (dId) => {
    setOpen(false);
    setPending(true);
    try { await onAssign(dId); } finally { setPending(false); }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !pending && setOpen(!open)}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${
          current
            ? "border-white/10 bg-white/[0.02] text-white hover:border-amber-400/20"
            : "border-dashed border-amber-400/30 bg-amber-400/[0.04] text-amber-300 hover:border-amber-400/50 hover:bg-amber-400/[0.06]"
        }`}
      >
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            <span className="flex-1 text-left text-slate-400">Assigning…</span>
          </>
        ) : current ? (
          <>
            <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${driverDot(current.status)}`} />
            <span className="flex-1 text-left font-medium">{current.name}</span>
            <span className="text-xs text-slate-500">{current.vehicle}</span>
          </>
        ) : (
          <>
            <Car className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1 text-left font-medium">Assign a driver…</span>
          </>
        )}
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-slate-500" />
      </button>
      {open && !pending && (
        <div
          role="listbox"
          aria-label="Assign driver"
          className="absolute left-0 right-0 top-full z-[60] mt-1 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl"
        >
          <button
            role="option"
            aria-selected={currentDriverId == null}
            onClick={() => handleAssign(null)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 ${
              currentDriverId == null ? "text-amber-300" : "text-slate-500"
            }`}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
            Unassigned
          </button>
          {drivers.length > 0 && <div className="mx-4 my-1 border-t border-white/5" />}
          {drivers.map((d) => (
            <button
              key={d.id}
              role="option"
              aria-selected={d.id === currentDriverId}
              onClick={() => handleAssign(d.id)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-sm transition hover:bg-white/5 ${
                d.id === currentDriverId ? "text-amber-300" : "text-slate-300"
              }`}
            >
              <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${driverDot(d.status)}`} />
              <span className="flex-1 text-left">{d.name}</span>
              <span className="text-xs text-slate-600">{d.vehicle || d.status}</span>
              {d.id === currentDriverId && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PAYMENT_STATES = [
  { value: "Unpaid",   color: "border-red-400/30 bg-red-400/10 text-red-300",         dot: "bg-red-400" },
  { value: "Invoiced", color: "border-amber-400/30 bg-amber-400/10 text-amber-300",   dot: "bg-amber-400" },
  { value: "Paid",     color: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300", dot: "bg-emerald-400" },
];

function PaymentBadge({ paymentStatus, onUpdate }) {
  const [pending, setPending] = useState(false);
  const current = PAYMENT_STATES.find((s) => s.value === paymentStatus) ?? PAYMENT_STATES[0];
  const next = PAYMENT_STATES[(PAYMENT_STATES.indexOf(current) + 1) % PAYMENT_STATES.length];

  const handleClick = async () => {
    if (pending) return;
    setPending(true);
    try { await onUpdate?.(next.value); } finally { setPending(false); }
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      title={`Payment: ${current.value} — click to mark as ${next.value}`}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${current.color}`}
    >
      {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className={`h-2 w-2 rounded-full ${current.dot}`} />}
      {current.value}
    </button>
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
  onUpdatePaymentStatus,
  onCreateReturn,
}) {
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const drawerRef = useRef(null);

  useEffect(() => {
    setNotes(booking?.notes ?? "");
    setEditingNotes(false);
  }, [booking?.id, booking?.notes]);

  // Close on outside click (pointerdown fires on touch too)
  useEffect(() => {
    const h = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
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
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" aria-hidden="true" />

      {/*
        Mobile:  bottom sheet — slides up from bottom, rounded top corners
        Desktop: right panel  — full-height side drawer
      */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-booking-title"
        className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#070D1F] shadow-2xl sm:bottom-auto sm:left-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-full sm:max-w-md sm:rounded-none sm:border-l sm:border-r-0 sm:border-t-0"
      >
        {/* Mobile drag handle */}
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between border-b border-white/5 px-5 py-4 sm:px-6 sm:py-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs text-slate-500">{booking.id}</p>
            <h2 id="drawer-booking-title" className="mt-1 truncate text-lg font-semibold text-white sm:text-xl">
              {booking.customer}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
            className="ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 text-slate-500 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ETA banner for active jobs */}
        {isActive && booking.pickupTime && (
          <div className="flex-shrink-0 border-b border-white/5 bg-amber-400/[0.04] px-5 py-3 sm:px-6">
            <p className="text-xs text-slate-500">Pickup</p>
            <div className="flex items-baseline gap-3">
              <span className="text-lg font-semibold text-white">{booking.time}</span>
              <ETACountdown pickupTime={booking.pickupTime} className="text-sm" />
            </div>
          </div>
        )}

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-6 px-5 py-5 sm:px-6">
            {/* Contact */}
            <div>
              <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-amber-400">Contact</p>
              <div className="space-y-3">
                {booking.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 flex-shrink-0 text-slate-600" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Phone</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2">
                        <p className="text-sm text-white">{booking.phone}</p>
                        {phoneHref && (
                          <a
                            href={phoneHref}
                            className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300 transition hover:bg-emerald-400/20"
                          >
                            Call
                          </a>
                        )}
                        {waHref && (
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-300 transition hover:bg-emerald-400/20"
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
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Email</p>
                      <a
                        href={`mailto:${booking.email}`}
                        className="mt-0.5 truncate text-sm text-blue-300 hover:underline"
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
                <div className="flex items-start gap-3">
                  <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-600" />
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Payment</p>
                    <div className="mt-1.5">
                      <PaymentBadge
                        paymentStatus={booking.paymentStatus ?? "Unpaid"}
                        onUpdate={(ps) => onUpdatePaymentStatus?.(booking.id, ps)}
                      />
                    </div>
                  </div>
                </div>
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
                    className="flex min-h-[36px] items-center gap-1 px-2 text-[10px] text-slate-500 transition hover:text-amber-300"
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
                      className="min-h-[44px] rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button
                      onClick={() => { setNotes(booking.notes ?? ""); setEditingNotes(false); }}
                      className="min-h-[44px] rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 transition hover:text-white"
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
        </div>

        {/* Footer actions */}
        <div className="flex-shrink-0 border-t border-white/5 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2">
            {/* Return journey */}
            {booking.airport && booking.destination && (
              <button
                onClick={() => onCreateReturn?.(booking)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/5 px-4 py-2.5 text-sm font-medium text-amber-300 transition hover:bg-amber-400/10"
              >
                <RefreshCw className="h-4 w-4" />
                Create Return Journey
              </button>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={() => onTogglePriority?.(booking.id)}
                className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition ${
                  booking.priority
                    ? "border-red-400/30 bg-red-400/10 text-red-300 hover:bg-red-400/20"
                    : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                {booking.priority ? "Remove Priority" : "Mark Priority"}
              </button>
              <button
                onClick={onClose}
                className="min-h-[44px] rounded-2xl border border-white/10 px-5 py-2.5 text-sm text-slate-400 transition hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
