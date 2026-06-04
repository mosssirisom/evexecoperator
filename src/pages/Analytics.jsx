import React, { useMemo, useState } from "react";
import { TrendingUp, Leaf, PoundSterling, Users, Calendar } from "lucide-react";
import { useBookings } from "../hooks/useBookings";

const PERIODS = ["Today", "7 Days", "30 Days", "All Time"];

function BarChart({ bars }) {
  const max = Math.max(...bars.map((d) => d.value), 1);
  return (
    <div className="flex h-40 items-end gap-1.5 sm:gap-2">
      {bars.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-lg bg-amber-400/20 transition-all duration-500 hover:bg-amber-400/40"
            style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? "4px" : "0" }}
            title={`£${d.value.toLocaleString()} — ${d.bookings} booking${d.bookings !== 1 ? "s" : ""}`}
          />
          <span className="text-[9px] text-slate-600 sm:text-[10px]">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState("7 Days");
  const { bookings } = useBookings();

  const parsePrice = (b) => parseFloat(String(b.price).replace("£", "")) || 0;

  // ── Build live "Today" data from real bookings ──────────────────────────────
  const todayData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayBookings = bookings.filter((b) => {
      if (!b.pickupTime) return false;
      const d = new Date(b.pickupTime);
      return d >= todayStart && d < todayEnd;
    });

    const completedRevenue = todayBookings
      .filter((b) => b.status === "Completed")
      .reduce((acc, b) => acc + parsePrice(b), 0);

    const windows = [
      { label: "06:00", start: 6, end: 9 },
      { label: "09:00", start: 9, end: 12 },
      { label: "12:00", start: 12, end: 15 },
      { label: "15:00", start: 15, end: 18 },
      { label: "18:00", start: 18, end: 21 },
      { label: "21:00", start: 21, end: 24 },
    ];

    const bars = windows.map(({ label, start, end }) => {
      const windowBookings = todayBookings.filter((b) => {
        const h = new Date(b.pickupTime).getHours();
        return h >= start && h < end;
      });
      const revenue = windowBookings.reduce((acc, b) => acc + parsePrice(b), 0);
      return { label, value: revenue, bookings: windowBookings.length };
    });

    const co2kg = Math.round(todayBookings.length * 7.3);

    return {
      bars,
      totalRevenue: completedRevenue,
      totalBookings: todayBookings.length,
      newCustomers: new Set(todayBookings.map((b) => b.phone || b.customer)).size,
      co2: `${co2kg}kg`,
      subRevenue: "Live today",
      peakDay: bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0] ?? { label: "—", value: 0 }),
    };
  }, [bookings]);

  // ── Build real data for 7 Days / 30 Days / All Time from actual bookings ────
  const liveData = useMemo(() => {
    const now = new Date();

    function buildBars(buckets) {
      return buckets.map(({ label, start, end }) => {
        const subset = bookings.filter((b) => {
          if (!b.pickupTime) return false;
          const t = new Date(b.pickupTime).getTime();
          return t >= start && t < end;
        });
        return {
          label,
          value: subset.reduce((acc, b) => acc + parsePrice(b), 0),
          bookings: subset.length,
        };
      });
    }

    function periodStats(periodBookings, subRevenue) {
      const co2kg = Math.round(periodBookings.length * 7.3);
      const uniqueCustomers = new Set(
        periodBookings.map((b) => b.phone || b.customer)
      ).size;
      return {
        newCustomers: uniqueCustomers,
        co2: co2kg > 0 ? `${co2kg.toLocaleString()}kg` : "0kg",
        subRevenue,
      };
    }

    // 7 Days: last 7 calendar days
    const sevenDayBuckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      return {
        label: d.toLocaleDateString("en-GB", { weekday: "short" }),
        start: d.getTime(),
        end: end.getTime(),
      };
    });

    // 30 Days: 4 rolling weeks, most recent = Wk 4
    const thirtyDayBuckets = Array.from({ length: 4 }, (_, i) => {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      weekEnd.setHours(23, 59, 59, 999);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);
      return {
        label: `Wk ${4 - i}`,
        start: weekStart.getTime(),
        end: weekEnd.getTime() + 1,
      };
    }).reverse();

    // All Time: last 6 calendar months
    const allTimeBuckets = Array.from({ length: 6 }, (_, i) => {
      const offset = 5 - i;
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 1);
      return {
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        start: d.getTime(),
        end: end.getTime(),
      };
    });

    const sevenStart = sevenDayBuckets[0].start;
    const thirtyStart = thirtyDayBuckets[0].start;

    const sevenDayBookings = bookings.filter(
      (b) => b.pickupTime && new Date(b.pickupTime).getTime() >= sevenStart
    );
    const thirtyDayBookings = bookings.filter(
      (b) => b.pickupTime && new Date(b.pickupTime).getTime() >= thirtyStart
    );

    return {
      "7 Days": {
        bars: buildBars(sevenDayBuckets),
        ...periodStats(sevenDayBookings, "Last 7 days"),
      },
      "30 Days": {
        bars: buildBars(thirtyDayBuckets),
        ...periodStats(thirtyDayBookings, "Last 30 days"),
      },
      "All Time": {
        bars: buildBars(allTimeBuckets),
        ...periodStats(bookings, "All loaded bookings"),
      },
    };
  }, [bookings]);

  const isToday = period === "Today";
  const periodData = isToday ? null : liveData[period];

  const bars = isToday ? todayData.bars : periodData?.bars ?? [];
  const totalRevenue = isToday
    ? todayData.totalRevenue
    : bars.reduce((acc, d) => acc + d.value, 0);
  const totalBookings = isToday
    ? todayData.totalBookings
    : bars.reduce((acc, d) => acc + d.bookings, 0);
  const newCustomers = isToday ? todayData.newCustomers : periodData?.newCustomers ?? 0;
  const co2 = isToday ? todayData.co2 : periodData?.co2 ?? "—";
  const subRevenue = isToday ? todayData.subRevenue : periodData?.subRevenue ?? "";
  const peakDay = isToday
    ? todayData.peakDay
    : bars.reduce((a, b) => (b.value > a.value ? b : a), bars[0] ?? { label: "—", value: 0 });

  const avgPerJob = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

  const topRoutes = useMemo(() => {
    const map = {};
    bookings.forEach((b) => {
      const key = b.route && b.route !== "—" ? b.route : null;
      if (!key) return;
      if (!map[key]) map[key] = { count: 0, revenue: 0 };
      map[key].count += 1;
      map[key].revenue += parsePrice(b);
    });
    return Object.entries(map)
      .map(([route, { count, revenue }]) => ({ route, count, revenue }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [bookings]);

  return (
    <div className="grid gap-6 p-4 sm:p-6 lg:p-10">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
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
        {isToday && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live data
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          {
            label: "Total Revenue",
            value: `£${totalRevenue.toLocaleString()}`,
            sub: subRevenue,
            icon: PoundSterling,
          },
          {
            label: "Total Bookings",
            value: totalBookings,
            sub: avgPerJob > 0 ? `Avg £${avgPerJob} per job` : "No completed jobs yet",
            icon: Calendar,
          },
          {
            label: "New Customers",
            value: newCustomers,
            sub: "Including automation recovery",
            icon: Users,
          },
          {
            label: "CO₂ Saved",
            value: co2,
            sub: "vs equivalent petrol fleet",
            icon: Leaf,
          },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03]">
                <kpi.icon className="h-4 w-4 text-amber-400" />
              </div>
              <TrendingUp className="h-3 w-3 text-emerald-400" />
            </div>
            <p className="text-sm text-slate-400">{kpi.label}</p>
            <p className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{kpi.value}</p>
            <p className="mt-2 text-xs text-slate-500">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Revenue bar chart */}
        <div className="card p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Revenue</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {period === "Today" ? "Today's Revenue" : `Revenue — ${period}`}
            </h2>
          </div>
          {bars.length > 0 ? (
            <>
              <BarChart bars={bars} />
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                <span>
                  Peak:{" "}
                  <span className="text-amber-300">
                    {peakDay.label} — £{peakDay.value.toLocaleString()}
                  </span>
                </span>
                <span>
                  Total:{" "}
                  <span className="text-white">£{totalRevenue.toLocaleString()}</span>
                </span>
              </div>
            </>
          ) : (
            <p className="py-12 text-center text-sm text-slate-600">No revenue data for today yet.</p>
          )}
        </div>

        {/* Top routes */}
        <div className="card p-5 sm:p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Routes</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Top Routes</h2>
          </div>
          {topRoutes.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-600">No route data yet.</p>
          ) : (
            <div className="space-y-4">
              {topRoutes.map((r) => (
                <div key={r.route}>
                  <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0 truncate text-slate-300">{r.route}</span>
                    <span className="flex-shrink-0 font-semibold text-amber-300">
                      £{r.revenue.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-amber-400/50 transition-all duration-500"
                      style={{ width: `${(r.count / topRoutes[0].count) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-right text-[10px] text-slate-600">{r.count} job{r.count !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
