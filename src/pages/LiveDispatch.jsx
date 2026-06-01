import React, { useState } from "react";
import BookingModal from "../components/BookingModal";
import StatusActionMenu from "../components/StatusActionMenu";
import {
  MapPin,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Filter,
} from "lucide-react";
import { useBookings } from "../hooks/useBookings";

const STATUS_FILTERS = [
  "All",
  "Dispatched",
  "En Route",
  "Passenger On Board",
  "Completed",
  "Unassigned / Missed Call Recovery",
];

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

function statusIcon(status) {
  switch (status) {
    case "Dispatched":
      return <Loader2 className="h-4 w-4 animate-spin text-amber-400" />;
    case "En Route":
      return <MapPin className="h-4 w-4 text-blue-400" />;
    case "Passenger On Board":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />;
    case "Completed":
      return <CheckCircle2 className="h-4 w-4 text-slate-400" />;
    default:
      return <AlertCircle className="h-4 w-4 text-red-400" />;
  }
}

export default function LiveDispatch() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const { bookings: transfers, createBooking, updateStatus } = useBookings();

  const filtered =
    activeFilter === "All"
      ? transfers
      : transfers.filter((t) => t.status === activeFilter);

  const stats = {
    active: transfers.filter((t) =>
      ["Dispatched", "En Route", "Passenger On Board"].includes(t.status)
    ).length,
    completed: transfers.filter((t) => t.status === "Completed").length,
    pending: transfers.filter((t) => t.priority).length,
  };

  return (
    <>
    <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={createBooking} />
    <div className="grid gap-6 p-10">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active Jobs", value: stats.active, color: "text-amber-300" },
          { label: "Completed Today", value: stats.completed, color: "text-emerald-300" },
          { label: "Needs Attention", value: stats.pending, color: "text-red-300" },
        ].map((s) => (
          <div key={s.label} className="card flex items-center gap-5 p-5">
            <p className={`text-4xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="text-sm text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Map placeholder */}
      <div className="card relative flex h-64 items-center justify-center overflow-hidden p-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.06),transparent_70%)]" />
        <div className="z-10 text-center">
          <MapPin className="mx-auto mb-3 h-8 w-8 text-amber-400/50" />
          <p className="text-sm text-slate-500">
            Live map integration — Phase 3
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Google Maps / Mapbox will render here with driver pins
          </p>
        </div>
        {/* Decorative grid */}
        <svg
          className="absolute inset-0 h-full w-full opacity-[0.04]"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Filter bar + table */}
      <div className="card p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
              Dispatch Board
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              All Transfers
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setModalOpen(true)}
              className="mr-2 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              + New Booking
            </button>
            <Filter className="h-4 w-4 self-center text-slate-500" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                {["Job ID", "Customer", "Route", "Flight", "Pickup", "Driver", "Price", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="pb-4 pr-6 text-[10px] uppercase tracking-[0.2em] text-slate-600 font-normal"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  className={`transition-colors ${
                    t.priority ? "bg-red-500/[0.03]" : "hover:bg-white/[0.02]"
                  }`}
                >
                  <td className="py-4 pr-6 font-mono text-xs text-slate-500">
                    {t.id}
                  </td>
                  <td className="py-4 pr-6 font-medium text-white">
                    {t.customer}
                  </td>
                  <td className="py-4 pr-6 text-slate-400 max-w-[200px] truncate">
                    {t.route}
                  </td>
                  <td className="py-4 pr-6 text-white">{t.flight}</td>
                  <td className="py-4 pr-6">
                    <div className="flex items-center gap-1.5 text-white">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      {t.time}
                    </div>
                  </td>
                  <td className="py-4 pr-6 text-slate-300">{t.driver}</td>
                  <td className="py-4 pr-6 font-semibold text-amber-300">
                    {t.price}
                  </td>
                  <td className="py-4 pr-6">
                    <StatusActionMenu
                      bookingId={t.id}
                      currentStatus={t.status}
                      onUpdate={updateStatus}
                    />
                  </td>
                  <td className="py-4">
                    <button className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-slate-400 transition hover:border-amber-400/20 hover:text-amber-300">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-slate-600">
              No transfers match this filter.
            </p>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
