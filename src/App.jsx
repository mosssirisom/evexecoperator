import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Route,
  Users,
  Bot,
  BarChart3,
  Settings,
  Clock3,
  Plane,
  CarFront,
  PhoneMissed,
  Leaf,
  ShieldCheck,
  Navigation,
  UserCircle2,
  MoreVertical,
  Search,
  Bell,
} from "lucide-react";

const transfers = [
  {
    id: "EVX-1042",
    customer: "James Whitmore",
    flight: "EK017",
    route: "Manchester Airport MAN → Blackpool",
    time: "10:45",
    driver: "Nitisat Siri",
    price: "£160",
    status: "Dispatched",
    priority: false,
  },
  {
    id: "EVX-1043",
    customer: "Amelia Hart",
    flight: "FR4482",
    route: "Liverpool Airport LPL → Lytham St Annes",
    time: "11:20",
    driver: "Sarah Lane",
    price: "£145",
    status: "En Route",
    priority: false,
  },
  {
    id: "EVX-1044",
    customer: "Dr. Patel",
    flight: "BA1396",
    route: "Blackpool → Manchester Airport MAN",
    time: "12:10",
    driver: "Mark Ellison",
    price: "£160",
    status: "Passenger On Board",
    priority: false,
  },
  {
    id: "EVX-1045",
    customer: "Missed Call Lead",
    flight: "Pending",
    route: "Airport transfer enquiry",
    time: "12:35",
    driver: "Unassigned",
    price: "TBC",
    status: "Unassigned / Missed Call Recovery",
    priority: true,
  },
  {
    id: "EVX-1046",
    customer: "Laura Bennett",
    flight: "U22133",
    route: "Manchester Airport MAN → Poulton-le-Fylde",
    time: "14:00",
    driver: "David King",
    price: "£160",
    status: "Completed",
    priority: false,
  },
];

const drivers = [
  {
    name: "Nitisat Siri",
    status: "Available soon",
    job: "MAN → Blackpool",
    vehicle: "Tesla Model Y",
  },
  {
    name: "Sarah Lane",
    status: "En route",
    job: "LPL → Lytham",
    vehicle: "Tesla Model Y",
  },
  {
    name: "Mark Ellison",
    status: "Passenger onboard",
    job: "Blackpool → MAN",
    vehicle: "Mercedes EQE",
  },
  {
    name: "David King",
    status: "Available",
    job: "No active job",
    vehicle: "Tesla Model 3",
  },
];

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Live Dispatch", icon: Route },
  { label: "Driver Management", icon: Users },
  { label: "Automated Bookings", icon: Bot },
  { label: "Analytics", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
      <Clock3 className="h-4 w-4 text-amber-400" />
      <span className="text-sm font-medium text-white tracking-wide">
        {time.toLocaleTimeString("en-GB")}
      </span>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-24 flex-col items-center border-r border-white/5 bg-[#050B17] py-6">
      <div className="mb-12 flex h-14 w-14 items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-400/10">
        <Navigation className="h-6 w-6 text-amber-400" />
      </div>
      <nav className="flex flex-1 flex-col gap-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              className={`group relative flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 ${
                item.active
                  ? "bg-amber-400/10 text-amber-300 shadow-[0_0_30px_rgba(212,175,55,0.18)]"
                  : "text-slate-500 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.active && (
                <span className="absolute -right-[22px] h-8 w-1 rounded-full bg-amber-400" />
              )}
            </button>
          );
        })}
      </nav>
      <button className="flex h-14 w-14 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-white/5 hover:text-white">
        <UserCircle2 className="h-6 w-6" />
      </button>
    </aside>
  );
}

function MetricCard({ title, value, sub, icon: Icon }) {
  return (
    <div className="card p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03]">
          <Icon className="h-5 w-5 text-amber-400" />
        </div>
        <span className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
          Live
        </span>
      </div>
      <p className="text-sm text-slate-400">{title}</p>
      <h3 className="mt-2 text-4xl font-semibold tracking-tight text-white">
        {value}
      </h3>
      <p className="mt-3 text-sm text-slate-500">{sub}</p>
    </div>
  );
}

function statusClasses(status) {
  switch (status) {
    case "Dispatched":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "En Route":
      return "border-blue-400/30 bg-blue-400/10 text-blue-300";
    case "Passenger On Board":
      return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Completed":
      return "border-slate-500/30 bg-slate-500/10 text-slate-300";
    default:
      return "border-red-400/30 bg-red-400/10 text-red-300";
  }
}

function TransferRow({ transfer }) {
  return (
    <div
      className={`rounded-3xl border p-5 transition-all duration-300 ${
        transfer.priority
          ? "border-red-500/30 bg-red-500/[0.04]"
          : "border-white/5 bg-white/[0.02] hover:border-amber-400/20 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
              {transfer.id}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
                transfer.status
              )}`}
            >
              {transfer.status}
            </span>
          </div>
          <div className="flex gap-4">
            <div className="mt-1 flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/5 bg-[#050B17]">
              {transfer.priority ? (
                <PhoneMissed className="h-5 w-5 text-red-300" />
              ) : (
                <Plane className="h-5 w-5 text-amber-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white">
                {transfer.customer}
              </h3>
              <p className="mt-1 text-sm text-slate-400">{transfer.route}</p>
              <div className="mt-5 grid gap-4 md:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    Flight
                  </p>
                  <p className="mt-1 text-sm text-white">{transfer.flight}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    Pickup
                  </p>
                  <p className="mt-1 text-sm text-white">{transfer.time}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    Driver
                  </p>
                  <p className="mt-1 text-sm text-white">{transfer.driver}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                    Fixed Price
                  </p>
                  <p className="mt-1 text-sm font-semibold text-amber-300">
                    {transfer.price}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:border-amber-400/20 hover:bg-amber-400/10 hover:text-amber-200">
          Manage
        </button>
      </div>
    </div>
  );
}

function DriverFleet() {
  return (
    <div className="card p-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-400">
            Driver Fleet
          </p>
          <h3 className="mt-2 text-xl font-semibold text-white">
            Active vehicle availability
          </h3>
        </div>
        <CarFront className="h-5 w-5 text-amber-400" />
      </div>
      <div className="space-y-4">
        {drivers.map((driver) => (
          <div
            key={driver.name}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-medium text-white">{driver.name}</h4>
                <p className="mt-1 text-xs text-slate-500">{driver.vehicle}</p>
              </div>
              <MoreVertical className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-emerald-300">{driver.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{driver.job}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const metrics = useMemo(
    () => [
      {
        title: "Total Bookings Today",
        value: "18",
        sub: "£2,640 confirmed revenue",
        icon: ShieldCheck,
      },
      {
        title: "Active En-Route Transfers",
        value: "3",
        sub: "Live airport operations",
        icon: Route,
      },
      {
        title: "Missed Call Recovery Queue",
        value: "4",
        sub: "Automation awaiting confirmation",
        icon: PhoneMissed,
      },
      {
        title: "CO₂ Savings",
        value: "86kg",
        sub: "Estimated EV operation savings",
        icon: Leaf,
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-[#0B132B] text-white">
      <Sidebar />
      <main className="ml-24 min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.10),transparent_30%),linear-gradient(180deg,#0B132B_0%,#050814_100%)]">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0B132B]/80 px-10 py-6 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-amber-400">
                EV Exec
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                Operator Dashboard
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
            <div className="flex items-center gap-4">
              <button className="glass flex h-12 w-12 items-center justify-center rounded-2xl">
                <Bell className="h-5 w-5 text-slate-300" />
              </button>
              <LiveClock />
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

        <div className="grid gap-6 p-10">
          <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.title} {...metric} />
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="card p-6">
              <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
                    Live Dispatch
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                    Today's Transfers
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Real-time operational transfer overview
                  </p>
                </div>
                <button className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400">
                  Create Booking
                </button>
              </div>
              <div className="space-y-4">
                {transfers.map((transfer) => (
                  <TransferRow key={transfer.id} transfer={transfer} />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <DriverFleet />
              <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
                <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
                  Automation Watch
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  Missed Call Recovery Active
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Automated follow-up monitoring missed calls, incomplete
                  enquiries and unassigned airport transfer requests.
                </p>
                <button className="mt-6 w-full rounded-2xl border border-amber-400/20 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10">
                  Review Queue
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
