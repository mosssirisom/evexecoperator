import React, { useMemo, useState } from "react";
import {
  Route,
  PhoneMissed,
  Leaf,
  ShieldCheck,
  Plane,
  CarFront,
  MoreVertical,
} from "lucide-react";
import { transfers, drivers } from "../data/mockData";
import BookingModal from "../components/BookingModal";

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
            key={driver.id}
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

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
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
    <>
    <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} />
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
            <button
              onClick={() => setModalOpen(true)}
              className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
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
              Automated follow-up monitoring missed calls, incomplete enquiries
              and unassigned airport transfer requests.
            </p>
            <button className="mt-6 w-full rounded-2xl border border-amber-400/20 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10">
              Review Queue
            </button>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
