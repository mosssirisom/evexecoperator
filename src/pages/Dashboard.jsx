import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Route,
  PhoneMissed,
  Leaf,
  ShieldCheck,
  Plane,
  CarFront,
  MoreVertical,
} from "lucide-react";
import BookingModal from "../components/BookingModal";
import { useToast } from "../components/Toast";
import { bookingStatusColor } from "../lib/statusColor";
import { useBookings } from "../hooks/useBookings";
import { useDrivers } from "../hooks/useDrivers";
import { useMissedCalls } from "../hooks/useMissedCalls";

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


function TransferRow({ transfer, onManage }) {
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
              className={`rounded-full border px-3 py-1 text-xs font-medium ${bookingStatusColor(
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
              <div className="mt-5 grid gap-4 grid-cols-2 md:grid-cols-4">
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
        <button
          onClick={onManage}
          className="rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:border-amber-400/20 hover:bg-amber-400/10 hover:text-amber-200"
        >
          Manage
        </button>
      </div>
    </div>
  );
}

function driverDotColor(status) {
  if (status === "Available") return "bg-emerald-400";
  if (status === "En route" || status === "Passenger onboard") return "bg-blue-400";
  if (status === "Available soon") return "bg-amber-400";
  return "bg-slate-500";
}

function driverTextColor(status) {
  if (status === "Available") return "text-emerald-300";
  if (status === "En route" || status === "Passenger onboard") return "text-blue-300";
  if (status === "Available soon") return "text-amber-300";
  return "text-slate-400";
}

function DriverFleet({ drivers }) {
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
              <span className={`h-2 w-2 rounded-full ${driverDotColor(driver.status)}`} />
              <span className={`text-sm ${driverTextColor(driver.status)}`}>{driver.status}</span>
            </div>
            <p className="mt-3 text-sm text-slate-400">{driver.job}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 animate-pulse">
      <div className="flex gap-4">
        <div className="h-12 w-12 rounded-2xl bg-white/[0.04]" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-1/3 rounded-full bg-white/[0.04]" />
          <div className="h-3 w-1/2 rounded-full bg-white/[0.03]" />
          <div className="h-3 w-2/3 rounded-full bg-white/[0.03]" />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [modalOpen, setModalOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { bookings, loading: bookingsLoading, error: bookingsError, createBooking } = useBookings();
  const { drivers } = useDrivers();
  const { calls } = useMissedCalls();

  const handleCreateBooking = useCallback(async (form) => {
    const result = await createBooking(form);
    toast({ message: `Booking ${result.ref} created successfully`, type: "success" });
    return result;
  }, [createBooking, toast]);

  const activeCount = bookings.filter((b) =>
    ["Dispatched", "En Route", "Passenger On Board"].includes(b.status)
  ).length;
  const totalRevenue = bookings
    .filter((b) => b.status === "Completed")
    .reduce((acc, b) => acc + (parseFloat(String(b.price).replace("£", "")) || 0), 0);

  const metrics = useMemo(
    () => [
      {
        title: "Total Bookings Today",
        value: bookings.length,
        sub: totalRevenue > 0 ? `£${totalRevenue.toLocaleString()} confirmed revenue` : "Tracking live",
        icon: ShieldCheck,
      },
      {
        title: "Active En-Route Transfers",
        value: activeCount,
        sub: "Live airport operations",
        icon: Route,
      },
      {
        title: "Missed Call Recovery Queue",
        value: calls.length,
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
    [bookings, calls]
  );

  return (
    <>
    <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreateBooking} />
    <div className="grid gap-6 p-4 sm:p-6 lg:p-10">
      {bookingsError && (
        <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-300">
          Failed to load bookings: {bookingsError}
        </div>
      )}
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
            {bookingsLoading
              ? [1, 2, 3].map((i) => <SkeletonRow key={i} />)
              : bookings.map((transfer) => (
                  <TransferRow key={transfer.id} transfer={transfer} onManage={() => navigate("/dispatch")} />
                ))
            }
          </div>
        </div>

        <div className="space-y-6">
          <DriverFleet drivers={drivers} />
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
            <button
              onClick={() => navigate("/bookings")}
              className="mt-6 w-full rounded-2xl border border-amber-400/20 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10"
            >
              Review Queue
            </button>
          </div>
        </div>
      </section>
    </div>
    </>
  );
}
