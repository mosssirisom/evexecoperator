"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X, Phone, Mail, Plane, MapPin, Clock, Car, PoundSterling,
  User, AlertTriangle, FileText, ChevronDown, Check, Edit3, Loader2, RefreshCw,
  CreditCard, Trash2, ShieldCheck, Send, Users, Briefcase, Calendar, RotateCcw, XCircle,
} from "lucide-react";
import { bookingStatusColor } from "@/lib/operator/statusColor";
import { reverseTarget, reverseLabel } from "@/lib/operator/statusFlow";
import ETACountdown from "./ETACountdown";

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
  const reverse = reverseTarget(currentStatus);
  const canCancel = currentStatus !== "Cancelled";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !isUpdating && setOpen(!open)}
        disabled={isUpdating}
        aria-haspopup="menu"
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
          role="menu"
          aria-label="Correct booking status"
          className="absolute left-0 top-full z-[60] mt-1 w-64 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl"
        >
          {confirmCancel ? (
            <div className="px-4 py-3 space-y-2">
              <p className="text-xs text-slate-300">Cancel this booking?</p>
              <p className="text-[10px] text-slate-500">The customer will be texted that it's cancelled.</p>
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
            <>
              <p className="px-4 pb-1 pt-2 text-[10px] uppercase tracking-[0.2em] text-slate-600">Correct status</p>
              <p className="px-4 pb-2 text-[10px] leading-snug text-slate-600">
                The driver advances the job in the driver app. Here you can only reverse a step or cancel.
              </p>
              {reverse && (
                <button
                  role="menuitem"
                  onClick={() => handleSelect(reverse)}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-xs text-slate-200 transition hover:bg-white/5"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-300" />
                  {reverseLabel(currentStatus)}
                </button>
              )}
              {canCancel && (
                <button
                  role="menuitem"
                  onClick={() => setConfirmCancel(true)}
                  className="flex w-full items-center gap-2.5 px-4 py-3 text-xs text-red-300 transition hover:bg-white/5"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel job
                </button>
              )}
              {!reverse && !canCancel && (
                <p className="px-4 py-3 text-xs text-slate-500">Nothing to change.</p>
              )}
            </>
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

// How the customer is paying — surfaced at dispatch so the driver/operator
// knows whether to take a card machine, chase a payment link, etc.
const PAYMENT_METHODS = ["Card", "Card machine", "Payment link", "Cash", "Bank transfer"];

function PaymentMethodPicker({ value, onSelect }) {
  const [pending, setPending] = useState(null);
  return (
    <div className="flex flex-wrap gap-1.5">
      {PAYMENT_METHODS.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            disabled={pending !== null}
            onClick={async () => {
              setPending(m);
              try { await onSelect?.(active ? null : m); } finally { setPending(null); }
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              active
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
            }`}
          >
            {pending === m ? "…" : m}
          </button>
        );
      })}
    </div>
  );
}

// One-tap "the fare has been paid" action — the smart shortcut operators use to
// say a booking was settled in advance. Toggles straight to Paid (or back to
// Unpaid), which in turn drops the fare from the driver's 24h reminder.
function MarkFarePaidButton({ paid, onSet }) {
  const [pending, setPending] = useState(false);
  const handle = async () => {
    if (pending) return;
    setPending(true);
    try { await onSet?.(paid ? "Unpaid" : "Paid"); } finally { setPending(false); }
  };
  return (
    <button
      type="button"
      onClick={handle}
      disabled={pending}
      title={paid ? "Fare paid in advance — tap to undo" : "Mark the fare as paid in advance"}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
        paid
          ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25"
          : "border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
      }`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      {paid ? "Fare paid ✓" : "Mark fare paid"}
    </button>
  );
}

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

const editInputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-400/40";

function EditField({ label, icon: Icon, children }) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </p>
      {children}
    </div>
  );
}

// Edit an existing booking's core details (passengers, bags, time, addresses…).
// Seeds from the booking, saves only what changed.
function BookingEditForm({ booking, onSave, onCancel }) {
  const initial = useMemo(
    () => ({
      customer: booking.customer ?? "",
      phone: booking.phone ?? "",
      email: booking.email && booking.email !== "—" ? booking.email : "",
      passengers: booking.passengers != null ? String(booking.passengers) : "",
      luggage: booking.luggage ?? "",
      travelDate: booking.travelDate ?? "",
      time: booking.time && booking.time !== "—" ? booking.time : "",
      pickupLocation: booking.pickupLocation ?? "",
      airport: booking.airport && booking.airport !== "—" ? booking.airport : "",
      dropoffAddress: booking.dropoffAddress ?? booking.destination ?? "",
      flight: booking.flight && booking.flight !== "—" ? booking.flight : "",
      price: booking.price && booking.price !== "TBC" ? booking.price.replace(/[^0-9.]/g, "") : "",
    }),
    [booking]
  );

  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    const changed = {};
    for (const k of Object.keys(initial)) {
      if (form[k] !== initial[k]) changed[k] = form[k].trim() === "" ? null : form[k].trim();
    }
    if (Object.keys(changed).length === 0) {
      onCancel();
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await onSave(changed);
    } catch (e) {
      setErr(e?.message ?? "Failed to save changes.");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 px-5 py-5 sm:px-6">
      <p className="text-[10px] uppercase tracking-[0.28em] text-amber-400">Edit booking</p>

      <EditField label="Customer" icon={User}>
        <input className={editInputCls} value={form.customer} onChange={set("customer")} placeholder="Customer name" />
      </EditField>
      <div className="grid grid-cols-2 gap-3">
        <EditField label="Phone" icon={Phone}>
          <input className={editInputCls} value={form.phone} onChange={set("phone")} inputMode="tel" placeholder="Phone number" />
        </EditField>
        <EditField label="Email" icon={Mail}>
          <input className={editInputCls} value={form.email} onChange={set("email")} inputMode="email" placeholder="name@email.com" />
        </EditField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <EditField label="Passengers" icon={Users}>
          <input className={editInputCls} value={form.passengers} onChange={set("passengers")} inputMode="numeric" placeholder="0" />
        </EditField>
        <EditField label="Bags" icon={Briefcase}>
          <input className={editInputCls} value={form.luggage} onChange={set("luggage")} placeholder="e.g. 2" />
        </EditField>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <EditField label="Pickup date" icon={Calendar}>
          <input type="date" className={editInputCls} value={form.travelDate} onChange={set("travelDate")} />
        </EditField>
        <EditField label="Pickup time" icon={Clock}>
          <input type="time" className={editInputCls} value={form.time} onChange={set("time")} />
        </EditField>
      </div>

      <EditField label="Pickup location" icon={MapPin}>
        <input className={editInputCls} value={form.pickupLocation} onChange={set("pickupLocation")} placeholder="Pickup address" />
      </EditField>
      <EditField label="Airport" icon={Plane}>
        <input className={editInputCls} value={form.airport} onChange={set("airport")} placeholder="e.g. Manchester T2" />
      </EditField>
      <EditField label="Drop-off address" icon={MapPin}>
        <input className={editInputCls} value={form.dropoffAddress} onChange={set("dropoffAddress")} placeholder="Destination address" />
      </EditField>

      <div className="grid grid-cols-2 gap-3">
        <EditField label="Flight" icon={Plane}>
          <input className={editInputCls} value={form.flight} onChange={set("flight")} placeholder="e.g. BA123" />
        </EditField>
        <EditField label="Price (£)" icon={PoundSterling}>
          <input className={editInputCls} value={form.price} onChange={set("price")} inputMode="decimal" placeholder="0.00" />
        </EditField>
      </div>

      {err && (
        <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 transition hover:border-white/20 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
        >
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : "Save changes"}
        </button>
      </div>
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
  onUpdatePaymentStatus,
  onUpdatePaymentMethod,
  onSendPaymentLink,
  onUpdateBooking,
  onCreateReturn,
  onDelete,
}) {
  const [notes, setNotes] = useState(booking?.notes ?? "");
  const [editingNotes, setEditingNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const drawerRef = useRef(null);

  const handleSaveEdit = useCallback(async (fields) => {
    await onUpdateBooking?.(booking.id, fields);
    setEditMode(false);
  }, [booking?.id, onUpdateBooking]);

  const sendPaymentLink = useCallback(async () => {
    if (!onSendPaymentLink) return;
    setLinkBusy(true);
    try {
      await onSendPaymentLink(booking.id);
    } finally {
      setLinkBusy(false);
    }
  }, [onSendPaymentLink, booking?.id]);

  useEffect(() => {
    // Reset the delete dialog whenever a different booking is opened.
    setDeleteOpen(false);
    setDeletePassword("");
    setDeleteError(null);
    setDeleteBusy(false);
  }, [booking?.id]);

  const confirmDelete = useCallback(async () => {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await onDelete?.(booking.id, deletePassword);
      // Parent closes the drawer on success.
    } catch (err) {
      setDeleteError(err?.message ?? "Failed to delete booking.");
      setDeleteBusy(false);
    }
  }, [booking?.id, deletePassword, onDelete]);

  useEffect(() => {
    setNotes(booking?.notes ?? "");
    setEditingNotes(false);
    setEditMode(false);
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
          <div className="ml-3 flex flex-shrink-0 items-center gap-2">
            {onUpdateBooking && !editMode && (
              <button
                onClick={() => setEditMode(true)}
                title="Edit booking"
                aria-label="Edit booking"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-slate-400 transition hover:bg-white/5 hover:text-amber-300"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 text-slate-500 transition hover:bg-white/5 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
          {editMode ? (
            <BookingEditForm
              key={booking.id}
              booking={booking}
              onSave={handleSaveEdit}
              onCancel={() => setEditMode(false)}
            />
          ) : (
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
                <Row icon={Users} label="Passengers" value={booking.passengers != null ? String(booking.passengers) : null} />
                <Row icon={Briefcase} label="Bags" value={booking.luggage || null} />
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
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <PaymentBadge
                        paymentStatus={booking.paymentStatus ?? "Unpaid"}
                        onUpdate={(ps) => onUpdatePaymentStatus?.(booking.id, ps)}
                      />
                      <MarkFarePaidButton
                        paid={(booking.paymentStatus ?? "Unpaid") === "Paid"}
                        onSet={(ps) => onUpdatePaymentStatus?.(booking.id, ps)}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
                      Marked paid = the fare was paid in advance, so the driver's 24-hour
                      reminder won't show a fare to collect.
                    </p>
                    {onUpdatePaymentMethod && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-600">Method</p>
                        <PaymentMethodPicker
                          value={booking.paymentMethod ?? null}
                          onSelect={(m) => onUpdatePaymentMethod?.(booking.id, m)}
                        />
                      </div>
                    )}
                    {onSendPaymentLink && (booking.paymentStatus ?? "Unpaid") !== "Paid" && (
                      <button
                        type="button"
                        onClick={sendPaymentLink}
                        disabled={linkBusy}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
                      >
                        {linkBusy ? (
                          <><Loader2 className="h-3.5 w-3.5 animate-spin" />Sending…</>
                        ) : (
                          <><Send className="h-3.5 w-3.5" />Text Stripe payment link</>
                        )}
                      </button>
                    )}
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
          )}
        </div>

        {/* Footer actions */}
        {!editMode && (
        <div className="flex-shrink-0 border-t border-white/5 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2">
            {/* Edit job — primary action, mirrors the Calendar's edit button */}
            {onUpdateBooking && (
              <button
                onClick={() => setEditMode(true)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
              >
                <Edit3 className="h-4 w-4" />
                Edit Job
              </button>
            )}
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
            {onDelete && (
              <button
                onClick={() => { setDeleteError(null); setDeletePassword(""); setDeleteOpen(true); }}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
                Delete Job
              </button>
            )}
          </div>
        </div>
        )}
      </div>

      {deleteOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-[#0B132B] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-300"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h2 className="text-lg font-bold text-white">Confirm job deletion</h2>
                <p className="mt-1 text-sm text-slate-400">For security, re-enter your operator password before deleting this booking.</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-sm">
              <p className="font-semibold text-slate-100">{booking.customer}</p>
              <p className="mt-1 text-xs text-slate-500">{booking.id} · {booking.route}</p>
            </div>
            <div className="mt-4 flex gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" /> This permanently removes the job from the operator and driver views.
            </div>
            {deleteError && (
              <p className="mt-3 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-xs text-red-300">{deleteError}</p>
            )}
            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Operator password</label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && deletePassword.trim() && !deleteBusy) confirmDelete(); }}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none focus:border-red-400/50"
              placeholder="Enter password"
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setDeleteOpen(false); setDeletePassword(""); setDeleteError(null); }}
                disabled={deleteBusy}
                className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:border-white/20 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteBusy || !deletePassword.trim()}
                className="flex-1 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
              >
                {deleteBusy ? "Verifying…" : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
