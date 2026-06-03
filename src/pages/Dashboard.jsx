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
  Clock,
  Car,
  BookOpen,
  UserCircle,
  Globe,
  ExternalLink,
} from "lucide-react";
import BookingModal from "../components/BookingModal";
import ETACountdown from "../components/ETACountdown";
import { useToast } from "../components/Toast";
import { bookingStatusColor } from "../lib/statusColor";
import { useBookings } from "../hooks/useBookings";
import { useDrivers } from "../hooks/useDrivers";
import { useMissedCalls } from "../hooks/useMissedCalls";
import { PORTALS } from "../lib/portals";

const PORTAL_QUICK_LINKS = [
  { key: "driverApp",      icon: Car,        label: "Driver Portal",    color: "text-blue-300",    bg: "bg-blue-400/10",    border: "border-blue-400/20" },
  { key: "bookingForm",    icon: BookOpen,   label: "Booking Form",     color: "text-amber-300",   bg: "bg-amber-400/10",   border: "border-amber-400/20" },
  { key: "customerAccount",icon: UserCircle, label: "My Account",       color: "text-emerald-300", bg: "bg-emerald-400/10", border: "border-emerald-400/20" },
  { key: "website",        icon: Globe,      label: "Website",          color: "text-slate-300",   bg: "bg-white/[0.04]",   border: "border-white/10" },
];

function PortalQuickLinks() {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Quick Launch</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Portals & Website</h3>
        </div>
        <ExternalLink className="h-4 w-4 text-slate-600" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PORTAL_QUICK_LINKS.map(({ key, icon: Icon, label, color, bg, border }) => (
          <a
            key={key}
            href={PORTALS[key].url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex flex-col items-center gap-2 rounded-2xl border ${border} ${bg} p-4 transition hover:opacity-80`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
            <span className={`text-center text-xs font-medium ${color}`}>{label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon: Icon }) {
  return (
    <div className="card p-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between sm:mb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/5 bg-white/[0.03] sm:h-12 sm:w-12">
          <Icon className="h-4 w-4 text-amber-400 sm:h-5 sm:w-5" />
        </div>
        <span className="text-[9px] uppercase tracking-[0.2em] text-slate-500 sm:text-[10px] sm:tracking-[0.25em]">Live</span>
      </div>
      <p className="text-xs text-slate-400 sm:text-sm">{title}</p>
      <h3 className="mt-1.5 text-2xl font-semibold tracking-tight text-white sm:mt-2 sm:text-4xl">{value}</h3>
      <p className="mt-2 text-xs text-slate-500 sm:mt-3 sm:text-sm">{sub}</p>
    </div>
  );
}

function UpcomingPickups({ bookings, onNavigate }) {
  const upcoming = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(
        (b) =>
          b.pickupTime &&
          new Date(b.pickupTime).getTime() > now - 30 * 60 * 1000 &&
          !["Completed", "Cancelled"].includes(b.status)
      )
      .sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime))
      .slice(0, 4);
  }, [bookings]);

  if (upcoming.length === 0) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Upcoming</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Next Pickups</h3>
        </div>
        <button
          onClick={onNavigate}
          className="min-h-[36px] px-2 text-xs text-slate-500 transition hover:text-amber-300"
        >
          View all →
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {upcoming.map((b) => (
          <button
            key={b.id}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-left transition hover:border-amber-400/20 hover:bg-amber-400/[0.03]"
          >
            <div className="w-12 flex-shrink-0 text-center">
              <p className="text-sm font-semibold text-white">{b.time}</p>
              {b.pickupTime && <ETACountdown pickupTime={b.pickupTime} />}
            </div>
            <div className="h-7 w-px flex-shrink-0 bg-white/10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{b.customer}</p>
              <p className="truncate text-xs text-slate-500">{b.driver}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-xs font-semibold text-amber-300">{b.price}</p>
              {b.priority && <span className="text-[10px] text-red-400">⚡ Priority</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TransferRow({ transfer, onManage }) {
  return (
    <div
      className={`rounded-3xl border p-4 transition-all duration-300 sm:p-5 ${
        transfer.priority
          ? "border-red-500/30 bg-red-500/[0.04]"
          : "border-white/5 bg-white/[0.02] hover:border-amber-400/20 hover:bg-white/[0.04]"
      }`}
    >
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{transfer.id}</span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${bookingStatusColor(transfer.status)}`}
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
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-white sm:text-lg">{transfer.customer}</h3>
              <p className="mt-1 text-sm text-slate-400">{transfer.route}</p>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Flight</p>
                  <p className="mt-1 text-sm text-white">{transfer.flight}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Pickup</p>
                  <p className="mt-1 text-sm text-white">{transfer.time}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Driver</p>
                  <p className="mt-1 text-sm text-white">{transfer.driver}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Price</p>
                  <p className="mt-1 text-sm font-semibold text-amber-300">{transfer.price}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={onManage}
          className="self-end rounded-2xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:border-amber-400/20 hover:bg-amber-400/10 hover:text-amber-200 xl:self-auto"
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
  const navigate = useNavigate();
  return (
    <div className="card p-5">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-amber-400">Driver Fleet</p>
          <h3 className="mt-2 text-xl font-semibold text-white">Active availability</h3>
        </div>
        <CarFront className="h-5 w-5 text-amber-400" />
      </div>
      <div className="space-y-3">
        {drivers.map((driver) => (
          <div
            key={driver.id}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-4"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <h4 className="font-medium text-white">{driver.name}</h4>
                <p className="mt-0.5 text-xs text-slate-500 truncate">{driver.vehicle}</p>
              </div>
              <button
                onClick={() => navigate("/drivers")}
                className="ml-2 text-slate-600 transition hover:text-slate-400"
                title="Manage driver"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${driverDotColor(driver.status)}`} />
              <span className={`text-sm ${driverTextColor(driver.status)}`}>{driver.status}</span>
            </div>
            <p className="mt-2 truncate text-sm text-slate-400">{driver.job}</p>
          </div>
        ))}
      </div>
      <button
        onClick={() => navigate("/drivers")}
        className="mt-4 w-full rounded-2xl border border-white/5 py-2.5 text-xs text-slate-500 transition hover:border-amber-400/20 hover:text-amber-300"
      >
        Manage Fleet →
      </button>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/5 bg-white/[0.02] p-5">
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

  const activeCount = useMemo(
    () => bookings.filter((b) => ["Dispatched", "En Route", "Passenger On Board"].includes(b.status)).length,
    [bookings]
  );

  const totalRevenue = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "Completed")
        .reduce((acc, b) => acc + (parseFloat(String(b.price).replace("£", "")) || 0), 0),
    [bookings]
  );

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
    [bookings, activeCount, totalRevenue, calls]
  );

  return (
    <>
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreateBooking} />
      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-10">
        {bookingsError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-300">
            Failed to load bookings: {bookingsError}
          </div>
        )}

        {/* KPI metric cards */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </section>

        {/* Portal quick-launch */}
        <PortalQuickLinks />

        {/* Upcoming pickups strip */}
        <UpcomingPickups bookings={bookings} onNavigate={() => navigate("/dispatch")} />

        {/* Main content: transfers list + sidebar */}
        <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="card p-5 sm:p-6">
            <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Live Dispatch</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                  Today's Transfers
                </h2>
                <p className="mt-2 text-sm text-slate-500">Real-time operational overview</p>
              </div>
              <button
                onClick={() => setModalOpen(true)}
                className="self-start rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 sm:self-auto"
              >
                + New Booking
              </button>
            </div>
            <div className="space-y-4">
              {bookingsLoading
                ? [1, 2, 3].map((i) => <SkeletonRow key={i} />)
                : bookings.map((transfer) => (
                    <TransferRow
                      key={transfer.id}
                      transfer={transfer}
                      onManage={() => navigate("/dispatch")}
                    />
                  ))}
              {!bookingsLoading && bookings.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600">No bookings yet today.</p>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <DriverFleet drivers={drivers} />
            <div className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
              <p className="text-xs uppercase tracking-[0.25em] text-amber-300">Automation Watch</p>
              <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
                Missed Call Recovery Active
              </h3>
              <p className="mt-3 text-sm leading-7 text-slate-400">
                Automated follow-up monitoring missed calls, incomplete enquiries and unassigned airport
                transfer requests.
              </p>
              {calls.length > 0 && (
                <p className="mt-2 text-sm font-medium text-red-300">
                  {calls.length} call{calls.length > 1 ? "s" : ""} awaiting follow-up
                </p>
              )}
              <button
                onClick={() => navigate("/bookings")}
                className="mt-5 w-full rounded-2xl border border-amber-400/20 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10"
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
