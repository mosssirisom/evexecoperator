import React, { useState } from "react";
import { TrendingUp, Leaf, PoundSterling, Users, Calendar } from "lucide-react";

const PERIODS = ["Today", "7 Days", "30 Days", "All Time"];

const revenueData = [
  { day: "Mon", value: 480, bookings: 3 },
  { day: "Tue", value: 320, bookings: 2 },
  { day: "Wed", value: 640, bookings: 4 },
  { day: "Thu", value: 800, bookings: 5 },
  { day: "Fri", value: 960, bookings: 6 },
  { day: "Sat", value: 1120, bookings: 7 },
  { day: "Sun", value: 640, bookings: 4 },
];

const topRoutes = [
  { route: "Manchester Airport → Blackpool", count: 48, revenue: "£7,680" },
  { route: "Manchester Airport → Lytham St Annes", count: 31, revenue: "£4,495" },
  { route: "Liverpool Airport → Blackpool", count: 22, revenue: "£3,300" },
  { route: "Blackpool → Manchester Airport", count: 19, revenue: "£3,040" },
  { route: "Manchester Airport → Poulton-le-Fylde", count: 14, revenue: "£2,240" },
];

const max = Math.max(...revenueData.map((d) => d.value));

function BarChart() {
  return (
    <div className="flex h-40 items-end gap-2">
      {revenueData.map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-lg bg-amber-400/20 transition-all duration-500 hover:bg-amber-400/40"
            style={{ height: `${(d.value / max) * 100}%` }}
            title={`£${d.value} — ${d.bookings} bookings`}
          />
          <span className="text-[10px] text-slate-600">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState("7 Days");

  const totalRevenue = revenueData.reduce((acc, d) => acc + d.value, 0);
  const totalBookings = revenueData.reduce((acc, d) => acc + d.bookings, 0);

  return (
    <div className="grid gap-6 p-10">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
              period === p
                ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                : "border-white/10 text-slate-500 hover:text-slate-300"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Total Revenue",
            value: `£${totalRevenue.toLocaleString()}`,
            sub: "+12% vs last week",
            icon: PoundSterling,
            positive: true,
          },
          {
            label: "Total Bookings",
            value: totalBookings,
            sub: `Avg £${Math.round(totalRevenue / totalBookings)} per job`,
            icon: Calendar,
            positive: true,
          },
          {
            label: "New Customers",
            value: "9",
            sub: "3 via automation recovery",
            icon: Users,
            positive: true,
          },
          {
            label: "CO₂ Saved",
            value: "604kg",
            sub: "vs equivalent petrol fleet",
            icon: Leaf,
            positive: true,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03]">
                <kpi.icon className="h-4 w-4 text-amber-400" />
              </div>
              <span
                className={`text-xs font-medium ${
                  kpi.positive ? "text-emerald-400" : "text-red-400"
                }`}
              >
                <TrendingUp className="inline h-3 w-3 mr-1" />
              </span>
            </div>
            <p className="text-sm text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-3xl font-semibold text-white">{kpi.value}</p>
            <p className="mt-2 text-xs text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="card p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
              Revenue
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Daily Revenue
            </h2>
          </div>
          <BarChart />
          <div className="mt-6 flex items-center gap-6 text-sm text-slate-500">
            <span>
              Peak:{" "}
              <span className="text-amber-300">
                Saturday — £{Math.max(...revenueData.map((d) => d.value))}
              </span>
            </span>
            <span>
              Avg:{" "}
              <span className="text-white">
                £{Math.round(totalRevenue / revenueData.length)}/day
              </span>
            </span>
          </div>
        </div>

        <div className="card p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
              Routes
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Top Routes
            </h2>
          </div>
          <div className="space-y-4">
            {topRoutes.map((r, i) => (
              <div key={r.route}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-slate-300 truncate pr-4 max-w-[200px]">
                    {r.route}
                  </span>
                  <span className="flex-shrink-0 font-semibold text-amber-300">
                    {r.revenue}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-amber-400/50"
                    style={{ width: `${(r.count / topRoutes[0].count) * 100}%` }}
                  />
                </div>
                <p className="mt-1 text-right text-[10px] text-slate-600">
                  {r.count} jobs
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
