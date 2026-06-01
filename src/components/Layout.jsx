import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Search, Bell } from "lucide-react";
import Sidebar from "./Sidebar";
import LiveClock from "./LiveClock";
import RealtimeDot from "./RealtimeDot";

const pageMeta = {
  "/": { label: "EV Exec", title: "Operator Dashboard" },
  "/dispatch": { label: "Live Operations", title: "Live Dispatch" },
  "/drivers": { label: "Fleet", title: "Driver Management" },
  "/bookings": { label: "Automation", title: "Automated Bookings" },
  "/analytics": { label: "Insights", title: "Analytics" },
  "/settings": { label: "System", title: "Settings" },
};

export default function Layout() {
  const { pathname } = useLocation();
  const meta = pageMeta[pathname] ?? pageMeta["/"];

  return (
    <div className="min-h-screen bg-[#0B132B] text-white">
      <Sidebar />
      <main className="ml-0 sm:ml-24 min-h-screen pb-20 sm:pb-0 bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.10),transparent_30%),linear-gradient(180deg,#0B132B_0%,#050814_100%)]">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0B132B]/80 px-4 py-4 sm:px-10 sm:py-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 sm:gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-400">
                {meta.label}
              </p>
              <h1 className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                {meta.title}
              </h1>
            </div>
            <div className="hidden flex-1 justify-center xl:flex">
              <div className="glass flex w-full max-w-lg items-center gap-3 rounded-2xl px-4 py-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search bookings, flights, drivers..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <RealtimeDot />
              <button className="glass flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl">
                <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-slate-300" />
              </button>
              <div className="hidden sm:block"><LiveClock /></div>
              <div className="glass hidden items-center gap-3 rounded-2xl px-3 py-2 lg:flex">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-400/10 text-sm font-semibold text-amber-300">
                  EV
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Operator</p>
                  <p className="text-xs text-slate-500">Control Room</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
