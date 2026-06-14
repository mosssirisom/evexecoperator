"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, Bell, X, Car, BookOpen, LogOut } from "lucide-react";
import Sidebar from "./Sidebar";
import LiveClock from "./LiveClock";
import RealtimeDot from "./RealtimeDot";
import ErrorBoundary from "./ErrorBoundary";
import { useMissedCalls } from "@/hooks/operator/useMissedCalls";
import { PORTALS } from "@/lib/operator/portals";

const pageMeta = {
  "/operator/dashboard": { label: "EV Exec", title: "Operator Dashboard" },
  "/operator/dispatch": { label: "Live Operations", title: "Live Dispatch" },
  "/operator/drivers": { label: "Fleet", title: "Driver Management" },
  "/operator/bookings": { label: "Automation", title: "Automated Bookings" },
  "/operator/analytics": { label: "Insights", title: "Analytics" },
  "/operator/settings": { label: "System", title: "Settings" },
};

function NotificationPopover({ calls, onClose, onNavigate, onResolve, onResolveAll }) {
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-white/10 bg-[#0B132B] shadow-2xl sm:w-80"
    >
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Alerts</p>
        <div className="flex items-center gap-2">
          {calls.length > 0 && (
            <button
              onClick={onResolveAll}
              className="text-[10px] text-slate-400 hover:text-amber-300 transition"
              title="Mark all as read"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="text-slate-500 hover:text-white transition">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {calls.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-600">No pending alerts</p>
        ) : (
          calls.map((c) => (
            <div key={c.id} className="flex items-start gap-3 border-b border-white/5 px-4 py-3 last:border-0">
              <div className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{c.caller}</p>
                <p className="mt-0.5 text-xs text-slate-500 truncate">{c.notes || "Missed call"}</p>
                <p className="mt-0.5 text-[10px] text-slate-600">{c.time}</p>
              </div>
              <button
                onClick={() => onResolve(c.id)}
                className="mt-0.5 flex-shrink-0 text-slate-600 hover:text-white transition"
                title="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-white/5 p-2">
        <button
          onClick={onNavigate}
          className="w-full rounded-xl py-2 text-xs text-amber-300 transition hover:bg-amber-400/10"
        >
          View all in Automation →
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children, onSignOut }) {
  const pathname = usePathname();
  const router = useRouter();
  const meta = pageMeta[pathname] ?? pageMeta["/operator/dashboard"];
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { calls, resolve, resolveAll } = useMissedCalls();
  const alertCount = calls.length;

  // Keep browser tab title in sync with the active page
  useEffect(() => {
    document.title = `${meta.title} — EV Exec`;
  }, [meta.title]);

  return (
    <div className="min-h-screen bg-[#0B132B] text-white">
      <Sidebar />
      <main className="ml-0 min-h-screen pb-20 sm:ml-24 sm:pb-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.10),transparent_30%),linear-gradient(180deg,#0B132B_0%,#050814_100%)]">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0B132B]/80 px-4 py-4 sm:px-10 sm:py-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3">

            {/* Page title — hidden when mobile search is open */}
            <div className={`min-w-0 flex-1 sm:flex-none ${searchOpen ? "hidden sm:block" : ""}`}>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-400">{meta.label}</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-3xl">
                {meta.title}
              </h1>
            </div>

            {/* Mobile search — expanded inline */}
            {searchOpen && (
              <div className="flex flex-1 items-center gap-2 sm:hidden">
                <div className="glass flex flex-1 items-center gap-3 rounded-2xl px-4 py-3">
                  <Search className="h-4 w-4 flex-shrink-0 text-slate-500" />
                  <input
                    autoFocus
                    type="text"
                    aria-label="Search bookings and drivers"
                    placeholder="Search bookings, drivers…"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                  />
                </div>
                <button
                  onClick={() => setSearchOpen(false)}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 text-slate-400 transition hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Desktop centre search */}
            <div className="hidden flex-1 justify-center xl:flex">
              <div className="glass flex w-full max-w-lg items-center gap-3 rounded-2xl px-4 py-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  aria-label="Search bookings, flights and drivers"
                  placeholder="Search bookings, flights, drivers..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              <RealtimeDot />

              {/* Portal quick-launch — hidden on very small screens, visible sm+ */}
              <a
                href={PORTALS.driverApp.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Driver Portal"
                className="glass hidden items-center justify-center rounded-2xl h-10 w-10 transition hover:bg-white/10 sm:flex"
              >
                <Car className="h-4 w-4 text-slate-300" />
              </a>
              <a
                href={PORTALS.bookingForm.url}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Customer Booking Form"
                className="glass hidden items-center justify-center rounded-2xl h-10 w-10 transition hover:bg-white/10 lg:flex"
              >
                <BookOpen className="h-4 w-4 text-slate-300" />
              </a>

              {/* Mobile search toggle */}
              {!searchOpen && (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="glass flex h-10 w-10 items-center justify-center rounded-2xl xl:hidden"
                  title="Search"
                >
                  <Search className="h-4 w-4 text-slate-300" />
                </button>
              )}

              {/* Bell with missed-call badge */}
              <div className="relative">
                <button
                  onClick={() => setBellOpen(!bellOpen)}
                  className="glass relative flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-white/10 sm:h-12 sm:w-12"
                  aria-label={alertCount > 0 ? `Notifications — ${alertCount} pending` : "Notifications"}
                  title="Notifications"
                >
                  <Bell className="h-4 w-4 text-slate-300 sm:h-5 sm:w-5" />
                  {alertCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                      {alertCount > 9 ? "9+" : alertCount}
                    </span>
                  )}
                </button>
                {bellOpen && (
                  <NotificationPopover
                    calls={calls}
                    onClose={() => setBellOpen(false)}
                    onNavigate={() => { setBellOpen(false); router.push("/operator/bookings"); }}
                    onResolve={resolve}
                    onResolveAll={resolveAll}
                  />
                )}
              </div>

              <div className="hidden sm:block">
                <LiveClock />
              </div>

              {/* Profile chip */}
              <button
                onClick={() => router.push("/operator/settings")}
                className="glass hidden items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-white/10 lg:flex"
                title="Settings"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-sm font-semibold text-amber-300">
                  EV
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Operator</p>
                  <p className="text-xs text-slate-500">Control Room</p>
                </div>
              </button>

              {/* Sign out */}
              <button
                onClick={onSignOut}
                className="glass flex h-10 w-10 items-center justify-center rounded-2xl transition hover:bg-white/10"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4 text-slate-300" />
              </button>
            </div>
          </div>
        </header>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}
