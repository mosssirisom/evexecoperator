"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";

// Delays filtering until the user stops typing, avoiding expensive re-renders on each keystroke
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
import BookingModal from "@/components/operator/BookingModal";
import StatusActionMenu from "@/components/operator/StatusActionMenu";
import DispatchButton from "@/components/operator/DispatchButton";
import BookingDetailDrawer from "@/components/operator/BookingDetailDrawer";
import ETACountdown from "@/components/operator/ETACountdown";
import {
  MapPin, Clock, Filter, Search, X, CalendarClock, List, AlertTriangle, Loader2, Phone, ChevronDown, Check, Car, Plane,
} from "lucide-react";
import { useOperatorToast } from "@/components/operator/Toast";
import { useBookings } from "@/hooks/operator/useBookings";
import { useDrivers } from "@/hooks/operator/useDrivers";
import { supabase } from "@/lib/supabase";
import { bookingStatusColor } from "@/lib/operator/statusColor";

function driverDot(status) {
  if (status === "Available") return "bg-emerald-400";
  if (status === "On Trip") return "bg-amber-400";
  return "bg-slate-600";
}

// Renders in a portal so the dropdown escapes the overflow-x-auto table wrapper
function InlineDriverCell({ bookingId, currentDriverId, drivers, onAssign }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const dropRef = useRef(null);
  const current = drivers.find((d) => d.id === currentDriverId);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (!btnRef.current?.contains(e.target) && !dropRef.current?.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [open]);

  const handleOpen = () => {
    if (pending) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  const handleAssign = async (dId) => {
    setOpen(false);
    setPending(true);
    try { await onAssign(bookingId, dId); } finally { setPending(false); }
  };

  return (
    <div>
      <button
        ref={btnRef}
        onClick={handleOpen}
        disabled={pending}
        className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition hover:bg-white/5 disabled:opacity-50 ${
          current ? "text-slate-300" : "font-medium text-amber-400 hover:text-amber-300"
        }`}
      >
        {pending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : current ? (
          <>
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${driverDot(current.status)}`} />
            {current.name}
          </>
        ) : (
          <span className="rounded-full border border-dashed border-amber-400/40 px-2 py-0.5">
            + Assign
          </span>
        )}
      </button>
      {open &&
        !pending &&
        createPortal(
          <div
            ref={dropRef}
            className="fixed z-[200] w-56 rounded-2xl border border-white/10 bg-[#0B132B] py-1 shadow-2xl"
            style={{ top: pos.top, left: pos.left }}
          >
            <button
              onClick={() => handleAssign(null)}
              className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs transition hover:bg-white/5 ${
                !currentDriverId ? "text-amber-300" : "text-slate-500"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-slate-700" />
              Unassigned
            </button>
            {drivers.length > 0 && <div className="mx-4 my-1 border-t border-white/5" />}
            {drivers.map((d) => (
              <button
                key={d.id}
                onClick={() => handleAssign(d.id)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-xs transition hover:bg-white/5 ${
                  d.id === currentDriverId ? "text-amber-300" : "text-slate-300"
                }`}
              >
                <span className={`h-2 w-2 flex-shrink-0 rounded-full ${driverDot(d.status)}`} />
                <span className="flex-1 text-left">{d.name}</span>
                <span className="text-slate-600">{d.vehicle || d.status}</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </div>
  );
}

const STATUS_FILTERS = [
  "All",
  "Unassigned",
  "Dispatched",
  "En Route",
  "Passenger On Board",
  "Completed",
  "Cancelled",
  "Unassigned / Missed Call Recovery",
];

// ── Schedule view row ─────────────────────────────────────────────────────────
function ScheduleRow({ booking, onSelect }) {
  const now = Date.now();
  const ts = booking.pickupTime ? new Date(booking.pickupTime).getTime() : null;
  const isPast = ts && ts < now - 30 * 60 * 1000;
  const isActive = ["Dispatched", "En Route", "Passenger On Board"].includes(booking.status);

  return (
    <button
      onClick={() => onSelect(booking)}
      className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition hover:border-amber-400/20 sm:px-5 ${
        isActive
          ? "border-amber-400/20 bg-amber-400/[0.04]"
          : isPast
          ? "border-white/[0.03] bg-white/[0.01] opacity-50"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <div className="w-14 flex-shrink-0 text-center">
        <p className="text-sm font-semibold text-white">{booking.time}</p>
        {booking.pickupTime && <ETACountdown pickupTime={booking.pickupTime} className="text-[10px]" />}
      </div>
      <div className="h-8 w-px bg-white/10" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-white">{booking.customer}</p>
          {booking.priority && <span className="flex-shrink-0 text-xs text-red-400">⚡</span>}
        </div>
        <p className="truncate text-xs text-slate-500">{booking.route}</p>
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs font-semibold text-amber-300">{booking.price}</p>
        <p className="text-xs text-slate-600">{booking.driver}</p>
      </div>
    </button>
  );
}

// ── Mobile status bottom-sheet picker ────────────────────────────────────────
const SHEET_STATUSES = [
  { value: "Dispatched",           color: "text-amber-300"   },
  { value: "En Route",             color: "text-blue-300"    },
  { value: "Passenger On Board",   color: "text-emerald-300" },
  { value: "Completed",            color: "text-slate-300"   },
  { value: "Cancelled",            color: "text-red-400"     },
];

function MobileStatusSheet({ booking, onUpdate, onClose }) {
  const [pending, setPending] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const handleSelect = async (value) => {
    if (value === booking.status) { onClose(); return; }
    if (value === "Cancelled") { setConfirmCancel(true); return; }
    setPending(value);
    try { await onUpdate(booking.id, value); onClose(); }
    catch { setPending(null); }
  };

  const handleConfirmCancel = async () => {
    setConfirmCancel(false);
    setPending("Cancelled");
    try { await onUpdate(booking.id, "Cancelled"); onClose(); }
    catch { setPending(null); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full rounded-t-[28px] border-t border-white/10 bg-[#070D1F]">
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-12 rounded-full bg-white/20" />
        </div>
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-400">Update Status</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{booking.customer}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto px-3 py-2">
          {confirmCancel ? (
            <div className="px-2 py-4">
              <p className="text-sm font-medium text-white">Cancel this booking?</p>
              <p className="mt-1 text-xs text-slate-500">This cannot be undone.</p>
              <div className="mt-4 flex gap-2">
                <button onClick={handleConfirmCancel} className="flex-1 rounded-2xl bg-red-500/20 px-3 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/30">
                  Yes, Cancel
                </button>
                <button onClick={() => setConfirmCancel(false)} className="flex-1 rounded-2xl border border-white/10 px-3 py-3 text-sm text-slate-400 transition hover:text-white">
                  Keep Job
                </button>
              </div>
            </div>
          ) : (
            SHEET_STATUSES.map((s) => {
              const isCurrent = s.value === booking.status;
              return (
                <button
                  key={s.value}
                  onClick={() => handleSelect(s.value)}
                  disabled={!!pending}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-sm transition ${
                    isCurrent ? "bg-amber-400/10 text-amber-300" : `${s.color} hover:bg-white/5`
                  }`}
                >
                  <span className="flex-1 text-left">{s.value}</span>
                  {isCurrent && <Check className="h-4 w-4 flex-shrink-0" />}
                  {s.value === pending && <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin" />}
                </button>
              );
            })
          )}
        </div>
        <div className="h-8" />
      </div>
    </div>,
    document.body
  );
}

// ── Mobile driver bottom-sheet picker ────────────────────────────────────────
function MobileDriverSheet({ booking, drivers, onAssign, onClose }) {
  const [pending, setPending] = useState(false);

  const handleSelect = async (driverId) => {
    if (driverId === booking.driverId) { onClose(); return; }
    setPending(true);
    try {
      await onAssign(booking.id, driverId);
      onClose();
    } catch {
      setPending(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full rounded-t-[28px] border-t border-white/10 bg-[#070D1F]">
        {/* Drag handle */}
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-12 rounded-full bg-white/20" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-amber-400">Assign Driver</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{booking.customer}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 transition hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* Driver options */}
        <div className="max-h-72 overflow-y-auto px-3 py-2">
          {/* Unassigned */}
          <button
            onClick={() => handleSelect(null)}
            disabled={pending}
            className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-sm transition ${
              !booking.driverId ? "bg-amber-400/10 text-amber-300" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-700" />
            <span className="flex-1 text-left">Unassigned</span>
            {!booking.driverId && <Check className="h-4 w-4 flex-shrink-0" />}
          </button>
          {/* Drivers */}
          {drivers.map((d) => {
            const isCurrent = d.id === booking.driverId;
            return (
              <button
                key={d.id}
                onClick={() => handleSelect(d.id)}
                disabled={pending}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-sm transition ${
                  isCurrent ? "bg-amber-400/10 text-amber-300" : "text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${driverDot(d.status)}`} />
                <span className="flex-1 text-left font-medium">{d.name}</span>
                <span className="text-xs text-slate-600">{d.vehicle || d.status}</span>
                {isCurrent && <Check className="h-4 w-4 flex-shrink-0 ml-1" />}
              </button>
            );
          })}
          {pending && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Assigning…
            </div>
          )}
        </div>
        {/* iOS safe-area spacer */}
        <div className="h-8" />
      </div>
    </div>,
    document.body
  );
}

// ── Mobile booking card ───────────────────────────────────────────────────────
function cardAccent(booking) {
  if (booking.priority) return "bg-red-500";
  if (["Dispatched", "En Route", "Passenger On Board"].includes(booking.status)) return "bg-amber-400";
  if (booking.status === "Completed") return "bg-emerald-400";
  if (booking.status === "Cancelled") return "bg-slate-700";
  return "bg-slate-600/50";
}

function BookingCard({ booking, onSelect, onStatusUpdate, drivers = [], onAssign }) {
  const [driverSheetOpen, setDriverSheetOpen] = useState(false);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const isActive = ["Dispatched", "En Route", "Passenger On Board"].includes(booking.status);
  const isCancelled = booking.status === "Cancelled";
  const statusLabel =
    booking.status === "Unassigned / Missed Call Recovery" ? "Missed Call" :
    booking.status === "Passenger On Board" ? "On Board" :
    booking.status;

  return (
    <div
      className={`relative overflow-visible rounded-2xl border transition ${
        booking.priority
          ? "border-red-500/20 bg-red-500/[0.04]"
          : isActive
          ? "border-amber-400/15 bg-amber-400/[0.03]"
          : "border-white/5 bg-white/[0.02]"
      } ${isCancelled ? "opacity-50" : ""}`}
    >
      {/* Left accent stripe */}
      <div className={`absolute left-2.5 top-3 bottom-3 w-0.5 rounded-full ${cardAccent(booking)}`} />

      {/* Full-card tap target */}
      <button
        type="button"
        onClick={() => onSelect(booking)}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`View details for ${booking.customer}`}
      />

      <div className="relative z-10 pl-5 pr-3 pt-3 pb-2.5">
        {/* Top row */}
        <div className="pointer-events-none flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {booking.priority && <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-400" />}
              <p className="truncate text-sm font-semibold text-white">{booking.customer}</p>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{booking.route}</p>
            {booking.flight && booking.flight !== "—" && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-600">
                <Plane className="h-2.5 w-2.5" /> {booking.flight}
              </p>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-col items-end text-right">
            <p className="text-sm font-bold text-amber-300">{booking.price}</p>
            <p className="text-[11px] text-slate-400">{booking.time}</p>
            {booking.pickupTime && (
              <ETACountdown pickupTime={booking.pickupTime} className="text-[10px]" />
            )}
            {(booking.paymentMethod || booking.paymentStatus !== "Paid") && (
              <span
                className={`mt-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                  booking.paymentStatus === "Paid"
                    ? "bg-emerald-400/10 text-emerald-400/90"
                    : booking.paymentStatus === "Invoiced"
                    ? "bg-amber-400/10 text-amber-300/90"
                    : "bg-red-400/10 text-red-300/90"
                }`}
              >
                {booking.paymentMethod || booking.paymentStatus}
              </span>
            )}
          </div>
        </div>

        {/* Bottom action bar: status pill (tappable) | driver | phone */}
        <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2">
          <button
            onClick={(e) => { e.stopPropagation(); setStatusSheetOpen(true); }}
            className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium transition active:opacity-70 ${bookingStatusColor(booking.status)}`}
          >
            {statusLabel}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setDriverSheetOpen(true); }}
            className={`min-w-0 flex-1 truncate text-left text-[11px] transition active:opacity-70 ${
              booking.driverId ? "text-slate-400" : "font-medium text-amber-400/80"
            }`}
          >
            {booking.driver || "Unassigned"}
          </button>
          {booking.phone && (
            <a
              href={`tel:${booking.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-400/25 bg-emerald-400/10 text-emerald-300 transition active:bg-emerald-400/20"
              aria-label={`Call ${booking.customer}`}
            >
              <Phone className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {statusSheetOpen && (
        <MobileStatusSheet
          booking={booking}
          onUpdate={onStatusUpdate}
          onClose={() => setStatusSheetOpen(false)}
        />
      )}
      {driverSheetOpen && (
        <MobileDriverSheet
          booking={booking}
          drivers={drivers}
          onAssign={onAssign}
          onClose={() => setDriverSheetOpen(false)}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DispatchPage() {
  return (
    <Suspense fallback={null}>
      <DispatchPageContent />
    </Suspense>
  );
}

function DispatchPageContent() {
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(
    searchParams.get("view") === "schedule" ? "schedule" : "board"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [returnPrefill, setReturnPrefill] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const searchRef = useRef(null);

  const toast = useOperatorToast();
  const {
    bookings: transfers,
    totalCount,
    loading,
    loadingMore,
    loadMore,
    error,
    createBooking,
    updateStatus,
    assignDriver,
    updateNotes,
    togglePriority,
    updatePaymentStatus,
    updatePaymentMethod,
    updateBooking,
    deleteBooking,
  } = useBookings();
  const { drivers } = useDrivers();

  const debouncedSearch = useDebounce(search, 200);

  useEffect(() => {
    if (searchParams.get("view") === "schedule") setView("schedule");
  }, [searchParams]);

  // Keyboard shortcuts: N = new booking, / or F = focus search
  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "n" && !modalOpen && !inInput) {
        e.preventDefault();
        setModalOpen(true);
        return;
      }

      if ((e.key === "/" || e.key === "f") && !inInput) {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [modalOpen]);

  const handleStatusUpdate = useCallback(async (id, status) => {
    try {
      await updateStatus(id, status);
      toast({ message: `Status → ${status}`, type: "success" });
      setSelectedBooking((prev) => (prev?.id === id ? { ...prev, status } : prev));
    } catch (err) {
      toast({ message: err?.message ?? "Failed to update status", type: "error" });
    }
  }, [updateStatus, toast]);

  const handleDeleteBooking = useCallback(async (id, password) => {
    // Throws on bad password / failure so the drawer's modal can show the error
    // and keep itself open; on success we close the drawer.
    await deleteBooking(id, password);
    toast({ message: `Booking ${id} deleted`, type: "success" });
    setSelectedBooking(null);
  }, [deleteBooking, toast]);

  const handleAssignDriver = useCallback(async (id, driverId) => {
    const driver = drivers.find((d) => d.id === driverId);
    try {
      await assignDriver(id, driverId, driver?.name ?? null);
      toast({ message: driver ? `Assigned to ${driver.name}` : "Driver unassigned", type: "success" });
      setSelectedBooking((prev) => {
        if (prev?.id !== id) return prev;
        return { ...prev, driverId, driver: driver?.name ?? "Unassigned" };
      });
    } catch (err) {
      toast({ message: err?.message ?? "Failed to assign driver", type: "error" });
    }
  }, [assignDriver, drivers, toast]);

  const handleUpdateNotes = useCallback(async (id, notes) => {
    await updateNotes(id, notes);
    setSelectedBooking((prev) => (prev?.id === id ? { ...prev, notes } : prev));
  }, [updateNotes]);

  const handleTogglePriority = useCallback(async (id) => {
    try {
      await togglePriority(id);
      setSelectedBooking((prev) => {
        if (prev?.id !== id) return prev;
        return { ...prev, priority: !prev.priority };
      });
    } catch (err) {
      toast({ message: err?.message ?? "Failed to update priority", type: "error" });
    }
  }, [togglePriority, toast]);

  const handleCreateBooking = useCallback(async (form) => {
    const result = await createBooking(form);
    toast({ message: `Booking ${result.ref} created`, type: "success" });
    return result;
  }, [createBooking, toast]);

  const handleUpdatePaymentStatus = useCallback(async (id, ps) => {
    try {
      await updatePaymentStatus(id, ps);
      setSelectedBooking((prev) => (prev?.id === id ? { ...prev, paymentStatus: ps } : prev));
    } catch (err) {
      toast({ message: err?.message ?? "Failed to update payment status", type: "error" });
    }
  }, [updatePaymentStatus, toast]);

  const handleUpdatePaymentMethod = useCallback(async (id, method) => {
    try {
      await updatePaymentMethod(id, method);
      setSelectedBooking((prev) => (prev?.id === id ? { ...prev, paymentMethod: method } : prev));
      toast({ message: method ? `Payment method: ${method}` : "Payment method cleared", type: "success" });
    } catch (err) {
      toast({ message: err?.message ?? "Failed to update payment method", type: "error" });
    }
  }, [updatePaymentMethod, toast]);

  const handleUpdateBooking = useCallback(async (id, fields) => {
    try {
      await updateBooking(id, fields);
      setSelectedBooking((prev) => (prev?.id === id ? { ...prev, ...fields } : prev));
      toast({ message: "Booking updated", type: "success" });
    } catch (err) {
      toast({ message: err?.message ?? "Failed to update booking", type: "error" });
      throw err;
    }
  }, [updateBooking, toast]);

  const handleSendPaymentLink = useCallback(async (id) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        toast({ message: "Please sign in again to send a payment link.", type: "error" });
        return;
      }
      const res = await fetch("/api/payment-link", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ ref: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ message: data?.error ?? "Could not create payment link.", type: "error" });
        return;
      }
      // Reflect the method locally so the badge/chip update immediately.
      await updatePaymentMethod(id, "Payment link").catch(() => {});
      setSelectedBooking((prev) => (prev?.id === id ? { ...prev, paymentMethod: "Payment link" } : prev));
      toast({
        message: data?.sent ? "Stripe payment link texted to the customer." : "Payment link created.",
        type: "success",
      });
    } catch (err) {
      toast({ message: err?.message ?? "Could not create payment link.", type: "error" });
    }
  }, [updatePaymentMethod, toast]);

  const handleCreateReturn = useCallback((booking) => {
    const flip = (dir) =>
      dir === "Airport → Destination" ? "Destination → Airport" : "Airport → Destination";
    const rawPrice = booking.price !== "TBC" ? booking.price.replace(/[^0-9.]/g, "") : "";
    setReturnPrefill({
      customer:      booking.customer ?? "",
      phone:         booking.phone ?? "",
      email:         booking.email ?? "",
      flight:        "",
      direction:     flip(booking.direction ?? "Airport → Destination"),
      airport:       booking.airport ?? "",
      destination:   booking.destination ?? "",
      customAddress: "",
      date:          "",
      time:          "",
      driver:        "",
      price:         rawPrice,
      notes:         "",
    });
    setSelectedBooking(null);
    setModalOpen(true);
  }, []);

  const filtered = useMemo(() => {
    let list = transfers;
    if (activeFilter !== "All") list = list.filter((t) => t.status === activeFilter);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.customer.toLowerCase().includes(q) ||
          t.flight.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.driver.toLowerCase().includes(q) ||
          t.route.toLowerCase().includes(q)
      );
    }
    return list;
  }, [transfers, activeFilter, debouncedSearch]);

  const schedule = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return transfers
      .filter((t) => {
        if (!t.pickupTime) return false;
        const d = new Date(t.pickupTime);
        return d >= today && d < tomorrow;
      })
      .sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
  }, [transfers]);

  const stats = useMemo(
    () => ({
      active: transfers.filter((t) =>
        ["Dispatched", "En Route", "Passenger On Board"].includes(t.status)
      ).length,
      completed: transfers.filter((t) => t.status === "Completed").length,
      pending: transfers.filter(
        (t) =>
          t.status === "Unassigned / Missed Call Recovery" ||
          (t.status === "Unassigned" && t.priority)
      ).length,
    }),
    [transfers]
  );

  const liveSelectedBooking = useMemo(() => {
    if (!selectedBooking) return null;
    return transfers.find((t) => t.id === selectedBooking.id) ?? selectedBooking;
  }, [selectedBooking, transfers]);

  return (
    <>
      <BookingModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setReturnPrefill(null); }}
        onSubmit={handleCreateBooking}
        initialValues={returnPrefill}
      />

      {liveSelectedBooking && (
        <BookingDetailDrawer
          booking={liveSelectedBooking}
          drivers={drivers}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={handleStatusUpdate}
          onAssignDriver={handleAssignDriver}
          onUpdateNotes={handleUpdateNotes}
          onTogglePriority={handleTogglePriority}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
          onUpdatePaymentMethod={handleUpdatePaymentMethod}
          onSendPaymentLink={handleSendPaymentLink}
          onUpdateBooking={handleUpdateBooking}
          onCreateReturn={handleCreateReturn}
          onDelete={handleDeleteBooking}
        />
      )}

      <div className="grid gap-3 p-3 sm:gap-6 sm:p-6 lg:p-10">
        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-300">
            Failed to load transfers: {error}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-4">
          {[
            { label: "Active", value: stats.active, color: "text-amber-300", dot: "bg-amber-400" },
            { label: "Completed", value: stats.completed, color: "text-emerald-300", dot: "bg-emerald-400" },
            { label: "Attention", value: stats.pending, color: "text-red-300", dot: "bg-red-400" },
          ].map((s) => (
            <div key={s.label} className="card flex flex-col items-center gap-0.5 p-2.5 text-center sm:flex-row sm:gap-5 sm:p-5 sm:text-left">
              <div className="flex items-center gap-1 sm:hidden">
                <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${s.dot}`} />
                <p className="text-[9px] uppercase tracking-widest text-slate-500">{s.label}</p>
              </div>
              <p className={`text-2xl font-bold sm:text-4xl ${s.color}`}>{s.value}</p>
              <p className="hidden text-sm text-slate-400 sm:block">{s.label}</p>
            </div>
          ))}
        </div>

        {/* View toggle + New Booking */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-white/10 p-1">
            <button
              onClick={() => setView("board")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition sm:px-4 ${
                view === "board"
                  ? "bg-amber-400/10 text-amber-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <List className="h-4 w-4" />
              Board
              {activeFilter !== "All" && filtered.length > 0 && (
                <span className="rounded-full bg-amber-400/20 px-1.5 text-xs text-amber-300">
                  {filtered.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setView("schedule")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition sm:px-4 ${
                view === "schedule"
                  ? "bg-amber-400/10 text-amber-300"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <CalendarClock className="h-4 w-4" />
              <span className="hidden sm:inline">Today's </span>Schedule
              {schedule.length > 0 && (
                <span className="rounded-full bg-amber-400/20 px-1.5 text-xs text-amber-300">
                  {schedule.length}
                </span>
              )}
            </button>
          </div>
          {/* Desktop new booking button */}
          <button
            onClick={() => setModalOpen(true)}
            title="New Booking (N)"
            className="hidden rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 sm:block"
          >
            + New Booking
          </button>
        </div>

        {view === "schedule" ? (
          /* ── Schedule view ──────────────────────────────────────────────── */
          <div className="card p-4 sm:p-6">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Today</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Schedule</h2>
              <p className="mt-1 text-sm text-slate-500">
                {schedule.length === 0
                  ? "No pickups scheduled for today"
                  : `${schedule.length} pickup${schedule.length > 1 ? "s" : ""} today`}
              </p>
            </div>
            <div className="space-y-3">
              {schedule.map((b) => (
                <ScheduleRow key={b.id} booking={b} onSelect={setSelectedBooking} />
              ))}
              {schedule.length === 0 && (
                <p className="py-12 text-center text-sm text-slate-600">
                  No pickups with a scheduled time for today.
                </p>
              )}
            </div>
          </div>
        ) : (
          /* ── Board view ─────────────────────────────────────────────────── */
          <div className="card p-3 sm:p-6">
            <div className="mb-3 flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between sm:mb-4 sm:gap-3">
              {/* Heading — hidden on mobile to save vertical space */}
              <div className="hidden sm:block">
                <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Dispatch Board</p>
                <h2 className="mt-1.5 text-2xl font-semibold text-white">All Transfers</h2>
              </div>

              {/* Search + filter row */}
              <div className="flex flex-col gap-2 sm:gap-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customer, flight, ref… (/)"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-400/30 sm:py-3 lg:w-72"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Status filter chips — horizontally scrollable */}
                <div className="flex items-center gap-1.5">
                  <Filter className="h-3 w-3 flex-shrink-0 text-slate-600 sm:h-3.5 sm:w-3.5 sm:text-slate-500" />
                  <div className="flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-1.5">
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition sm:px-3 sm:py-1.5 sm:text-xs ${
                          activeFilter === f
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300"
                        }`}
                      >
                        {f === "Unassigned / Missed Call Recovery" ? "Missed Call" : f}
                      </button>
                    ))}
                  </div>
                  {activeFilter !== "All" && (
                    <button
                      onClick={() => setActiveFilter("All")}
                      className="flex-shrink-0 text-slate-600 hover:text-white transition"
                      title="Clear filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile + tablet card layout */}
            <div className="grid gap-2 lg:hidden">
              {loading && transfers.length === 0
                ? [1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                      <div className="h-4 w-1/3 rounded-full bg-white/[0.04]" />
                      <div className="mt-3 h-3 w-2/3 rounded-full bg-white/[0.03]" />
                    </div>
                  ))
                : filtered.map((t) => (
                    <BookingCard
                      key={t.id}
                      booking={t}
                      onSelect={setSelectedBooking}
                      onStatusUpdate={handleStatusUpdate}
                      drivers={drivers}
                      onAssign={handleAssignDriver}
                    />
                  ))}
              {!loading && filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600">
                  {debouncedSearch ? `No transfers match "${debouncedSearch}"` : "No transfers match this filter."}
                </p>
              )}
            </div>

            {/* Desktop table layout */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left">
                    {["Job ID", "Customer", "Route", "Flight", "Pickup", "ETA", "Driver", "Price", "Status", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="pb-4 pr-6 text-[10px] font-normal uppercase tracking-[0.2em] text-slate-600"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {loading &&
                    transfers.length === 0 &&
                    [1, 2, 3, 4].map((i) => (
                      <tr key={i} className="animate-pulse">
                        {[...Array(10)].map((_, j) => (
                          <td key={j} className="py-4 pr-6">
                            <div
                              className="h-3 rounded-full bg-white/[0.04]"
                              style={{ width: `${50 + j * 5}%` }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedBooking(t)}
                      className={`cursor-pointer transition-colors ${
                        t.priority ? "bg-red-500/[0.03]" : "hover:bg-white/[0.02]"
                      } ${selectedBooking?.id === t.id ? "bg-amber-400/[0.04]" : ""}`}
                    >
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-1.5">
                          {t.priority && (
                            <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-400" />
                          )}
                          <span className="font-mono text-xs text-slate-500">{t.id}</span>
                        </div>
                      </td>
                      <td className="py-4 pr-6 font-medium text-white">{t.customer}</td>
                      <td className="max-w-[180px] truncate py-4 pr-6 text-slate-400">{t.route}</td>
                      <td className="py-4 pr-6 text-white">{t.flight}</td>
                      <td className="py-4 pr-6">
                        <div className="flex items-center gap-1.5 text-white">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {t.time}
                        </div>
                      </td>
                      <td className="py-4 pr-6">
                        <ETACountdown pickupTime={t.pickupTime} />
                      </td>
                      <td className="py-4 pr-6" onClick={(e) => e.stopPropagation()}>
                        <InlineDriverCell
                          bookingId={t.id}
                          currentDriverId={t.driverId}
                          drivers={drivers}
                          onAssign={handleAssignDriver}
                        />
                      </td>
                      <td className="py-4 pr-6 font-semibold text-amber-300">{t.price}</td>
                      <td className="py-4 pr-6" onClick={(e) => e.stopPropagation()}>
                        <StatusActionMenu
                          bookingId={t.id}
                          currentStatus={t.status}
                          onUpdate={handleStatusUpdate}
                        />
                      </td>
                      <td className="py-4" onClick={(e) => e.stopPropagation()}>
                        <DispatchButton booking={t} driverName={t.driver} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && filtered.length === 0 && (
                <p className="py-10 text-center text-sm text-slate-600">
                  {debouncedSearch ? `No transfers match "${debouncedSearch}"` : "No transfers match this filter."}
                </p>
              )}
            </div>

            {/* Load more — shown on both mobile and desktop when more pages exist */}
            {totalCount > transfers.length && !debouncedSearch && activeFilter === "All" && (
              <div className="mt-4 flex items-center justify-center gap-4 border-t border-white/5 pt-4">
                <p className="text-xs text-slate-600">
                  Showing {transfers.length} of {totalCount} bookings
                </p>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-slate-400 transition hover:border-amber-400/20 hover:text-amber-300 disabled:opacity-50"
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile floating "+ New Booking" button */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-[5.5rem] right-4 z-40 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black shadow-xl shadow-amber-500/25 transition active:scale-95 sm:hidden"
      >
        + New Booking
      </button>
    </>
  );
}
