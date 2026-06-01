import React, { useMemo, useState } from "react";
import { TrendingUp, Leaf, PoundSterling, Users, Calendar } from "lucide-react";

const PERIODS = ["Today", "7 Days", "30 Days", "All Time"];

const DATA = {
  "Today": {
    bars: [
      { label: "06:00", value: 160, bookings: 1 },
      { label: "09:00", value: 320, bookings: 2 },
      { label: "12:00", value: 480, bookings: 3 },
      { label: "15:00", value: 160, bookings: 1 },
      { label: "18:00", value: 480, bookings: 3 },
      { label: "21:00", value: 160, bookings: 1 },
    ],
    newCustomers: 2,
    co2: "86kg",
    subRevenue: "Live today",
  },
  "7 Days": {
    bars: [
      { label: "Mon", value: 480, bookings: 3 },
      { label: "Tue", value: 320, bookings: 2 },
      { label: "Wed", value: 640, bookings: 4 },
      { label: "Thu", value: 800, bookings: 5 },
      { label: "Fri", value: 960, bookings: 6 },
      { label: "Sat", value: 1120, bookings: 7 },
      { label: "Sun", value: 640, bookings: 4 },
    ],
    newCustomers: 9,
    co2: "604kg",
    subRevenue: "+12% vs last week",
  },
  "30 Days": {
    bars: [
      { label: "Wk 1", value: 4800, bookings: 30 },
      { label: "Wk 2", value: 5600, bookings: 35 },
      { label: "Wk 3", value: 4160, bookings: 26 },
      { label: "Wk 4", value: 6400, bookings: 40 },
    ],
    newCustomers: 34,
    co2: "2,416kg",
    subRevenue: "+8% vs last month",
  },
  "All Time": {
    bars: [
      { label: "Jan", value: 12800, bookings: 80 },
      { label: "Feb", value: 11200, bookings: 70 },
      { label: "Mar", value: 14400, bookings: 90 },
      { label: "Apr", value: 16000, bookings: 100 },
      { label: "May", value: 19200, bookings: 120 },
      { label: "Jun", value: 17600, bookings: 110 },
    ],
    newCustomers: 142,
    co2: "12,400kg",
    subRevenue: "Since launch",
  },
};

const topRoutes = [
  { route: "Manchester Airport → Blackpool", count: 48, revenue: "£7,680" },
  { route: "Manchester Airport → Lytham St Annes", count: 31, revenue: "£4,495" },
  { route: "Liverpool Airport → Blackpool", count: 22, revenue: "£3,300" },
  { route: "Blackpool → Manchester Airport", count: 19, revenue: "£3,040" },
  { route: "Manchester Airport → Poulton-le-Fylde", count: 14, revenue: "£2,240" },
];

function BarChart({ bars }) {
  const max = Math.max(...bars.map((d) => d.value));
  return (
    <div className="flex h-40 items-end gap-2">
      {bars.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-lg bg-amber-400/20 transition-all duration-500 hover:bg-amber-400/40"
            style={{ height: `${(d.value / max) * 100}%` }}
            title={`£${d.value.toLocaleString()} — ${d.bookings} bookings`}
          />
          <span className="text-[10px] text-slate-600">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState("7 Days");
  const data = DATA[period];

  const totalRevenue = useMemo(() => data.bars.reduce((acc, d) => acc + d.value, 0), [data]);
  const totalBookings = useMemo(() => data.bars.reduce((acc, d) => acc + d.bookings, 0), [data]);
  const peakDay = useMemo(() => data.bars.reduce((a, b) => (b.value > a.value ? b : a)), [data]);

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
            sub: data.subRevenue,
            icon: PoundSterling,
          },
          {
            label: "Total Bookings",
            value: totalBookings,
            sub: `Avg £${Math.round(totalRevenue / totalBookings)} per job`,
            icon: Calendar,
          },
          {
            label: "New Customers",
            value: data.newCustomers,
            sub: "Including automation recovery",
            icon: Users,
          },
          {
            label: "CO₂ Saved",
            value: data.co2,
            sub: "vs equivalent petrol fleet",
            icon: Leaf,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03]">
                <kpi.icon className="h-4 w-4 text-amber-400" />
              </div>
              <TrendingUp className="h-3 w-3 text-emerald-400" />
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
              {period === "Today" ? "Today's Revenue" : `Revenue — ${period}`}
            </h2>
          </div>
          <BarChart bars={data.bars} />
          <div className="mt-6 flex items-center gap-6 text-sm text-slate-500">
            <span>
              Peak:{" "}
              <span className="text-amber-300">
                {peakDay.label} — £{peakDay.value.toLocaleString()}
              </span>
            </span>
            <span>
              Total:{" "}
              <span className="text-white">
                £{totalRevenue.toLocaleString()}
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
            {topRoutes.map((r) => (
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
