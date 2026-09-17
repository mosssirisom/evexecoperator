"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Route,
  Users,
  BarChart3,
  Settings,
  Navigation,
  UserCircle2,
  Car,
  BookOpen,
  CalendarDays,
  FileText,
} from "lucide-react";
import { PORTALS } from "@/lib/operator/portals";

// Trimmed to five essentials for a clean, thumb-reachable mobile bar. The old
// Dashboard duplicated Dispatch, and the Automation page was a mock; both were
// folded away (their routes redirect to Dispatch).
const navItems = [
  { label: "Calendar", icon: CalendarDays, href: "/operator/calendar" },
  { label: "Dispatch", icon: Route, href: "/operator/dispatch" },
  { label: "Drivers", icon: Users, href: "/operator/drivers" },
  { label: "Invoices", icon: FileText, href: "/operator/invoices" },
  { label: "Analytics", icon: BarChart3, href: "/operator/analytics" },
  { label: "Settings", icon: Settings, href: "/operator/settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop: fixed left rail */}
      <aside className="hidden sm:flex fixed left-0 top-0 z-50 h-screen w-24 flex-col items-center border-r border-white/5 bg-[#050B17] py-6">
        <div className="mb-12 flex h-14 w-14 items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-400/10">
          <Navigation className="h-6 w-6 text-amber-400" />
        </div>
        <nav className="flex flex-1 flex-col gap-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                className={`group relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
                  isActive
                    ? "bg-amber-400/10 text-amber-300 shadow-[0_0_30px_rgba(212,165,80,0.18)]"
                    : "text-slate-500 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {isActive && (
                  <span className="absolute -right-[22px] h-8 w-1 rounded-full bg-amber-400" />
                )}
              </Link>
            );
          })}
        </nav>
        {/* External portal links */}
        <div className="mb-2 flex flex-col items-center gap-2 border-t border-white/5 pt-4">
          <a
            href={PORTALS.driverApp.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Driver Portal"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white/5 hover:text-amber-300"
          >
            <Car className="h-4 w-4" />
          </a>
          <a
            href={PORTALS.bookingForm.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Customer Booking Form"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white/5 hover:text-amber-300"
          >
            <BookOpen className="h-4 w-4" />
          </a>
        </div>

        <button
          title="Profile"
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white/5 hover:text-white"
        >
          <UserCircle2 className="h-6 w-6" />
        </button>
      </aside>

      {/* Mobile: fixed bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-white/5 bg-[#050B17]/95 px-1 pt-1 pb-[calc(env(safe-area-inset-bottom)+0.25rem)] backdrop-blur-xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${
                isActive ? "text-amber-300" : "text-slate-500"
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? "text-amber-300" : "text-slate-500"}`} />
              <span className={`text-[10px] font-medium ${isActive ? "text-amber-300" : "text-slate-600"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}