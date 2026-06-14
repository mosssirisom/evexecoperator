"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, LayoutGrid, CalendarClock, Map as MapIcon } from "lucide-react";
import BookingModal from "@/components/operator/BookingModal";
import BookingDetailDrawer from "@/components/operator/BookingDetailDrawer";
import FilterPills from "@/components/operator/shared/FilterPills";
import BoardView from "@/components/operator/dispatch/BoardView";
import TimelineView from "@/components/operator/dispatch/TimelineView";
import MapView from "@/components/operator/dispatch/MapView";
import { useOperatorToast } from "@/components/operator/Toast";
import { useBookings } from "@/hooks/operator/useBookings";
import { useDrivers } from "@/hooks/operator/useDrivers";
import { QUICK_FILTERS, matchesQuickFilter } from "@/lib/operator/dispatchFilters";

// Delays filtering until the user stops typing, avoiding expensive re-renders on each keystroke
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const VIEWS = [
  { key: "board", label: "Board", icon: LayoutGrid },
  { key: "timeline", label: "Timeline", icon: CalendarClock },
  { key: "map", label: "Map", icon: MapIcon },
];

// ── Main component ────────────────────────────────────────────────────────────────────
export default function DispatchPage() {
  return (
    <Suspense fallback={null}>
      <DispatchPageContent />
    </Suspense>
  );
}

function DispatchPageContent() {
  const searchParams = useSearchParams();
  const [activeFilter, setActiveFilter] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState(
    searchParams.get("view") === "schedule" ? "timeline" : "board"
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
  } = useBookings();
  const { drivers } = useDrivers();

  const debouncedSearch = useDebounce(search, 200);

  // Back-compat: the old Schedule view is now folded into Timeline.
  useEffect(() => {
    if (searchParams.get("view") === "schedule") setView("timeline");
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
    if (activeFilter) list = list.filter((t) => matchesQuickFilter(t, activeFilter));
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

  const ViewComponent = view === "timeline" ? TimelineView : view === "map" ? MapView : BoardView;

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
          onCreateReturn={handleCreateReturn}
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

        {/* Live Dispatch Centre */}
        <div className="card p-3 sm:p-6">
          <div className="mb-3 flex flex-col gap-2.5 sm:mb-4 sm:gap-3">
            {/* Heading + view switcher + new booking */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="hidden sm:block">
                <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Live Dispatch Centre</p>
                <h2 className="mt-1.5 text-2xl font-semibold text-white">
                  {VIEWS.find((v) => v.key === view)?.label} View
                </h2>
              </div>

              <div className="flex items-center justify-between gap-2 sm:justify-end">
                <div className="flex items-center gap-1 rounded-2xl border border-white/10 p-1">
                  {VIEWS.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => setView(v.key)}
                      className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition sm:px-4 ${
                        view === v.key
                          ? "bg-amber-400/10 text-amber-300"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <v.icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{v.label}</span>
                    </button>
                  ))}
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
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-600" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer, flight, ref… (/)"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-9 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-400/30 sm:py-3 sm:max-w-sm"
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

            {/* Quick filter pills */}
            <FilterPills
              options={QUICK_FILTERS}
              value={activeFilter}
              onChange={(v) => setActiveFilter((prev) => (prev === v ? null : v))}
            />
          </div>

          <ViewComponent
            bookings={filtered}
            drivers={drivers}
            loading={loading}
            onViewDetails={setSelectedBooking}
            onEdit={setSelectedBooking}
            onAssignDriver={handleAssignDriver}
          />

          {/* Load more — only meaningful against the unfiltered dataset */}
          {totalCount > transfers.length && !debouncedSearch && !activeFilter && (
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
