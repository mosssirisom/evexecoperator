"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, X, LogOut, Plus, CalendarPlus, PhoneMissed } from "lucide-react";
import Sidebar from "./Sidebar";
import LiveClock from "./LiveClock";
import RealtimeDot from "./RealtimeDot";
import ErrorBoundary from "./ErrorBoundary";
import BookingModal, { customersFromBookings } from "./BookingModal";
import { useOperatorToast } from "./Toast";
import { useMissedCalls } from "@/hooks/operator/useMissedCalls";
import { useNewBookingAlerts } from "@/hooks/operator/useNewBookingAlerts";
import { useBookings } from "@/hooks/operator/useBookings";
import { playNewBookingChime } from "@/lib/operator/notificationSound";

const pageMeta = {
  "/operator/calendar": { label: "Schedule", title: "Calendar" },
  "/operator/dispatch": { label: "Live Operations", title: "Live Dispatch" },
  "/operator/drivers": { label: "Fleet", title: "Driver Management" },
  "/operator/invoices": { label: "Billing", title: "Invoices" },
  "/operator/analytics": { label: "Insights", title: "Analytics" },
  "/operator/settings": { label: "System", title: "Settings" },
};

function NotificationPopover({
  newBookings,
  calls,
  onClose,
  onResolve,
  onResolveAll,
  onOpenBooking,
  onDismissBooking,
  onClearBookings,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [onClose]);

  const total = newBookings.length + calls.length;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl sm:w-80"
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">Notifications</p>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <button
              onClick={() => { onResolveAll(); onClearBookings(); }}
              className="text-[10px] text-slate-500 hover:text-amber-600 transition"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-[#0F1B33] transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {total === 0 && (
          <p className="py-6 text-center text-sm text-slate-600">You're all caught up</p>
        )}

        {/* New bookings */}
        {newBookings.length > 0 && (
          <>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600/80">
              New bookings
            </p>
            {newBookings.map((b) => (
              <div key={`b-${b.id}`} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
                  <CalendarPlus className="h-3.5 w-3.5 text-emerald-600" />
                </div>
                <button onClick={() => onOpenBooking(b)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-medium text-[#0F1B33]">{b.customer}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{b.route}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">
                    {b.source === "website" ? "Online booking" : "New booking"}
                    {b.time ? ` · ${b.time}` : ""} · {b.ref}
                  </p>
                </button>
                <button
                  onClick={() => onDismissBooking(b.id)}
                  className="mt-0.5 flex-shrink-0 text-slate-600 hover:text-[#0F1B33] transition"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}

        {/* Missed calls */}
        {calls.length > 0 && (
          <>
            <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-red-600/80">
              Missed calls
            </p>
            {calls.map((c) => (
              <div key={`c-${c.id}`} className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-0">
                <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-red-400/10">
                  <PhoneMissed className="h-3.5 w-3.5 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F1B33]">{c.caller}</p>
                  <p className="mt-0.5 text-xs text-slate-500 truncate">{c.notes || "Missed call"}</p>
                  <p className="mt-0.5 text-[10px] text-slate-600">{c.time}</p>
                </div>
                <button
                  onClick={() => onResolve(c.id)}
                  className="mt-0.5 flex-shrink-0 text-slate-600 hover:text-[#0F1B33] transition"
                  title="Dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function Layout({ children, onSignOut }) {
  const pathname = usePathname();
  const router = useRouter();
  const meta = pageMeta[pathname] ?? pageMeta["/operator/dispatch"];
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [newBookingOpen, setNewBookingOpen] = useState(false);

  // The header search jumps to the Dispatch board filtered by the term — that
  // board already does the actual customer/flight/ref/driver matching.
  const submitSearch = useCallback(
    (e) => {
      e.preventDefault();
      const q = searchTerm.trim();
      setSearchOpen(false);
      router.push(q ? `/operator/dispatch?q=${encodeURIComponent(q)}` : "/operator/dispatch");
    },
    [searchTerm, router]
  );
  const { calls, resolve, resolveAll } = useMissedCalls();
  const { createBooking, bookings } = useBookings();
  const customers = useMemo(() => customersFromBookings(bookings), [bookings]);
  const toast = useOperatorToast();

  // Real-time new-booking alerts: toast + chime on arrival, and a running list
  // in the bell. Ignores bookings this operator just created themselves.
  const handleNewBooking = useCallback((b) => {
    toast({
      message: `New booking — ${b.customer}${b.route && b.route !== "New booking" ? ` (${b.route})` : ""}`,
      type: "success",
    });
    playNewBookingChime();
  }, [toast]);
  const { newBookings, clear: clearNewBookings, dismiss: dismissNewBooking } =
    useNewBookingAlerts({ onNew: handleNewBooking });

  const alertCount = calls.length + newBookings.length;

  const openBooking = useCallback((b) => {
    setBellOpen(false);
    dismissNewBooking(b.id);
    router.push(`/operator/dispatch?q=${encodeURIComponent(b.ref)}`);
  }, [router, dismissNewBooking]);

  // Dispatch has its own New Booking controls; show the global button elsewhere.
  const showNewBooking = pathname !== "/operator/dispatch";

  const handleCreateBooking = useCallback(async (form) => {
    const result = await createBooking(form);
    toast({
      message: result.returnRef
        ? `Booking ${result.ref} + return ${result.returnRef} created`
        : `Booking ${result.ref} created successfully`,
      type: "success",
    });
    return result;
  }, [createBooking, toast]);

  // Keep browser tab title in sync with the active page
  useEffect(() => {
    document.title = `${meta.title} — EV Exec`;
  }, [meta.title]);

  return (
    <div className="min-h-screen bg-white text-[#0F1B33]">
      <Sidebar />
      <main className="ml-0 min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] sm:ml-24 sm:pb-0 bg-[radial-gradient(circle_at_top_right,rgba(201,165,80,0.14),transparent_38%),linear-gradient(180deg,#EEF0F6_0%,#E4E7F0_100%)]">
        <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/85 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-10 sm:pb-6 sm:pt-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">

            {/* Page title — hidden when mobile search is open */}
            <div className={`min-w-0 flex-1 sm:flex-none ${searchOpen ? "hidden sm:block" : ""}`}>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-600">{meta.label}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#0F1B33] sm:text-3xl">
                {meta.title}
              </h1>
            </div>

            {/* Mobile search — expanded inline */}
            {searchOpen && (
              <form onSubmit={submitSearch} className="flex flex-1 items-center gap-2 sm:hidden">
                <div className="glass flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
                  <Search className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <input
                    autoFocus
                    type="search"
                    enterKeyHint="search"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search bookings and drivers"
                    placeholder="Search bookings, drivers…"
                    className="w-full bg-transparent text-sm text-[#0F1B33] outline-none placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:text-[#0F1B33]"
                >
                  <X className="h-4 w-4" />
                </button>
              </form>
            )}

            {/* Desktop centre search */}
            <form onSubmit={submitSearch} className="hidden flex-1 justify-center xl:flex">
              <div className="glass flex w-full max-w-lg items-center gap-3 rounded-2xl px-4 py-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="Search bookings, flights and drivers"
                  placeholder="Search bookings, flights, drivers…"
                  className="w-full bg-transparent text-sm text-[#0F1B33] outline-none placeholder:text-slate-400"
                />
              </div>
            </form>

            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <RealtimeDot />

              {/* Mobile search toggle */}
              {!searchOpen && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="glass flex h-10 w-10 items-center justify-center rounded-2xl xl:hidden"
                  title="Search"
                >
                  <Search className="h-4 w-4 text-slate-600" />
                </button>
              )}

              {/* Bell with missed-call badge */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen(!bellOpen)}
                  className="glass relative flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-slate-100 sm:h-12 sm:w-12"
                  aria-label={alertCount > 0 ? `Notifications — ${alertCount} pending` : "Notifications"}
                  title="Notifications"
                >
                  <Bell className="h-4 w-4 text-slate-600 sm:h-5 sm:w-5" />
                  {alertCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <NotificationPopover
                    newBookings={newBookings}
                    calls={calls}
                    onClose={() => setBellOpen(false)}
                    onResolve={resolve}
                    onResolveAll={resolveAll}
                    onOpenBooking={openBooking}
                    onDismissBooking={dismissNewBooking}
                    onClearBookings={clearNewBookings}
                  />
                )}
              </div>

              <div className="hidden sm:block">
                <LiveClock />
              </div>

              {/* Profile chip */}
              <button
                onClick={() => router.push("/operator/settings")}
                className="glass hidden items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-slate-100 lg:flex"
                title="Settings"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-sm font-semibold text-amber-600">
                  EV
                </div>
                <div>
                  <p className="text-sm font-medium text-[#0F1B33]">Operator</p>
                  <p className="text-xs text-slate-500">Control Room</p>
                </div>
              </button>

              {/* Sign out */}
              <button
                onClick={onSignOut}
                className="glass flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-slate-100"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4 text-slate-600" />
              </button>
            </div>
          </div>
        </header>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Global New Booking — one consistent action on every screen except
          Dispatch, which has its own. Sits above the mobile tab bar. */}
      {showNewBooking && (
        <button
          onClick={() => setNewBookingOpen(true)}
          title="New Booking"
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-black shadow-xl shadow-amber-500/25 transition active:scale-95 sm:bottom-6 sm:right-6"
        >
          <Plus className="h-4 w-4" />
          New Booking
        </button>
      )}
      <BookingModal
        open={newBookingOpen}
        onClose={() => setNewBookingOpen(false)}
        onSubmit={handleCreateBooking}
        customers={customers}
      />
    </div>
  );
}
