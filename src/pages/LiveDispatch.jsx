import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

// Delays filtering until the user stops typing, avoiding expensive re-renders on each keystroke
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
import BookingModal from "../components/BookingModal";
import StatusActionMenu from "../components/StatusActionMenu";
import DispatchButton from "../components/DispatchButton";
import BookingDetailDrawer from "../components/BookingDetailDrawer";
import ETACountdown from "../components/ETACountdown";
import {
  MapPin, Clock, Filter, Search, X, CalendarClock, List, AlertTriangle,
} from "lucide-react";
import { useToast } from "../components/Toast";
import { useBookings } from "../hooks/useBookings";
import { useDrivers } from "../hooks/useDrivers";
import { bookingStatusColor } from "../lib/statusColor";

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

// ── Mobile booking card ───────────────────────────────────────────────────────
// Uses an invisible <button> overlay for iOS tap compatibility (iOS only fires
// click on elements that are either <button>, <a>, or have cursor:pointer + onclick).
// The overlay button sits behind the card content at z-0; interactive children
// are z-10 so they receive their own events without propagating to the overlay.
function BookingCard({ booking, onSelect, onStatusUpdate }) {
  const isActive = ["Dispatched", "En Route", "Passenger On Board"].includes(booking.status);

  return (
    <div
      className={`relative w-full overflow-visible rounded-2xl border p-4 transition ${
        booking.priority
          ? "border-red-500/20 bg-red-500/[0.04]"
          : isActive
          ? "border-amber-400/20 bg-amber-400/[0.03]"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      {/* Invisible full-card tap target — a real <button> so iOS registers the tap */}
      <button
        type="button"
        onClick={() => onSelect(booking)}
        className="absolute inset-0 z-0 rounded-2xl"
        aria-label={`View details for ${booking.customer}`}
      />

      {/* Card content — z-10 so it renders above the tap target */}
      <div className="relative z-10">
        {/* Top row: info + price/time (pointer-events-none so taps reach the button) */}
        <div className="pointer-events-none flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {booking.priority && <AlertTriangle className="h-3 w-3 flex-shrink-0 text-red-400" />}
              <span className="font-mono text-[10px] text-slate-500">{booking.id}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${bookingStatusColor(booking.status)}`}>
                {booking.status === "Unassigned / Missed Call Recovery" ? "Missed Call" : booking.status}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">{booking.customer}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{booking.route}</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-base font-semibold text-amber-300">{booking.price}</p>
            <p className="mt-0.5 text-xs text-slate-500">{booking.time}</p>
            {booking.pickupTime && <ETACountdown pickupTime={booking.pickupTime} className="mt-0.5 text-[10px]" />}
          </div>
        </div>

        {/* Bottom row: driver name + status menu — pointer-events auto for interaction */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
          <p className="pointer-events-none truncate text-xs text-slate-400">{booking.driver || "Unassigned"}</p>
          <StatusActionMenu
            bookingId={booking.id}
            currentStatus={booking.status}
            onUpdate={onStatusUpdate}
            dropUp
          />
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LiveDispatch() {
  const [searchParams] = useSearchParams();
  const [activeFilter, setActiveFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [view, setView] = useState(
    searchParams.get("view") === "schedule" ? "schedule" : "board"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const toast = useToast();
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
  } = useBookings();
  const { drivers } = useDrivers();

  const debouncedSearch = useDebounce(search, 200);

  useEffect(() => {
    if (searchParams.get("view") === "schedule") setView("schedule");
  }, [searchParams]);

  // "N" keyboard shortcut opens the new booking modal
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key !== "n" || modalOpen || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      setModalOpen(true);
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

  const handleAssignDriver = useCallback(async (id, driverId) => {
    try {
      await assignDriver(id, driverId);
      const driver = drivers.find((d) => d.id === driverId);
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
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreateBooking} />

      {liveSelectedBooking && (
        <BookingDetailDrawer
          booking={liveSelectedBooking}
          drivers={drivers}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={handleStatusUpdate}
          onAssignDriver={handleAssignDriver}
          onUpdateNotes={handleUpdateNotes}
          onTogglePriority={handleTogglePriority}
        />
      )}

      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-10">
        {error && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-300">
            Failed to load transfers: {error}
          </div>
        )}

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Active", value: stats.active, color: "text-amber-300" },
            { label: "Completed", value: stats.completed, color: "text-emerald-300" },
            { label: "Attention", value: stats.pending, color: "text-red-300" },
          ].map((s) => (
            <div key={s.label} className="card flex flex-col items-center gap-1 p-4 text-center sm:flex-row sm:gap-5 sm:p-5 sm:text-left">
              <p className={`text-2xl font-semibold sm:text-4xl ${s.color}`}>{s.value}</p>
              <p className="text-[11px] text-slate-400 sm:text-sm">{s.label}</p>
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
          <button
            onClick={() => setModalOpen(true)}
            title="New Booking (N)"
            className="rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400"
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
          <div className="card p-4 sm:p-6">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Dispatch Board</p>
                <h2 className="mt-1.5 text-xl font-semibold text-white sm:text-2xl">All Transfers</h2>
              </div>

              {/* Search + filter row */}
              <div className="flex flex-col gap-3">
                {/* Search input */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search customer, flight, ref…"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-3 pl-9 pr-9 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-400/30 lg:w-64"
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
                <div className="flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {STATUS_FILTERS.map((f) => (
                      <button
                        key={f}
                        onClick={() => setActiveFilter(f)}
                        className={`flex-shrink-0 rounded-full border px-3 py-2 text-xs font-medium transition ${
                          activeFilter === f
                            ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                            : "border-white/10 text-slate-500 hover:border-white/20 hover:text-slate-300"
                        }`}
                      >
                        {f === "Unassigned / Missed Call Recovery" ? "Missed Call" : f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile card layout */}
            <div className="grid gap-3 sm:hidden">
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
                    />
                  ))}
              {!loading && filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600">
                  {debouncedSearch ? `No transfers match "${debouncedSearch}"` : "No transfers match this filter."}
                </p>
              )}
            </div>

            {/* Desktop table layout */}
            <div className="hidden overflow-x-auto sm:block">
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
                      <td className="py-4 pr-6 text-slate-300">{t.driver}</td>
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
    </>
  );
}
