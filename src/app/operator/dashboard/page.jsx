"use client";

import React, { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  UserPlus,
  Clock,
  PoundSterling,
  PhoneMissed,
  CreditCard,
  Plus,
  Inbox,
  LayoutGrid,
  Users,
} from "lucide-react";
import BookingModal from "@/components/operator/BookingModal";
import BookingDetailDrawer from "@/components/operator/BookingDetailDrawer";
import LiveClock from "@/components/operator/LiveClock";
import RealtimeDot from "@/components/operator/RealtimeDot";
import { useOperatorToast } from "@/components/operator/Toast";
import { useBookings } from "@/hooks/operator/useBookings";
import { useDrivers } from "@/hooks/operator/useDrivers";
import { useMissedCalls } from "@/hooks/operator/useMissedCalls";
import StatCard from "@/components/operator/shared/StatCard";
import ActionRequiredPanel from "@/components/operator/shared/ActionRequiredPanel";
import TransferCard from "@/components/operator/shared/TransferCard";
import EmptyState from "@/components/operator/shared/EmptyState";
import QuickActionMenu from "@/components/operator/shared/QuickActionMenu";

const ACTIVE_STATUSES = ["Dispatched", "En Route", "Passenger On Board"];

function priceToNumber(price) {
  return parseFloat(String(price ?? "").replace(/[^0-9.]/g, "")) || 0;
}

function TransferCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 rounded-2xl p-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-16 rounded-full bg-white/[0.04]" />
        <div className="h-4 w-20 rounded-full bg-white/[0.04]" />
      </div>
      <div className="h-4 w-3/4 rounded-full bg-white/[0.04]" />
      <div className="h-3 w-1/2 rounded-full bg-white/[0.03]" />
      <div className="h-9 rounded-xl bg-white/[0.03]" />
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useOperatorToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const {
    bookings,
    loading: bookingsLoading,
    error: bookingsError,
    createBooking,
    updateStatus,
    updateStatusOverride,
    assignDriver,
    updateNotes,
    togglePriority,
    updatePaymentStatus,
  } = useBookings();
  const { drivers } = useDrivers();
  const { calls } = useMissedCalls();

  // ─── Header ────────────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const availableDrivers = drivers.filter((d) => d.status === "Available").length;
  const operational =
    drivers.length === 0
      ? { label: "No drivers configured", dot: "bg-slate-400", text: "border-white/10 bg-white/5 text-slate-300" }
      : availableDrivers > 0
        ? { label: "Operational", dot: "bg-emerald-400", text: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" }
        : { label: "All drivers busy", dot: "bg-amber-400", text: "border-amber-400/30 bg-amber-400/10 text-amber-300" };

  // ─── Derived stats ─────────────────────────────────────────────────────────

  const unassignedCount = useMemo(
    () => bookings.filter((b) => b.status?.startsWith("Unassigned")).length,
    [bookings]
  );

  const upcoming = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter(
        (b) =>
          b.pickupTime &&
          new Date(b.pickupTime).getTime() > now - 15 * 60 * 1000 &&
          ![ "Completed", "Cancelled"].includes(b.status)
      )
      .sort((a, b) => new Date(a.pickupTime) - new Date(b.pickupTime));
  }, [bookings]);

  const nextPickup = upcoming[0] ?? null;

  const completedBookings = useMemo(
    () => bookings.filter((b) => b.status === "Completed"),
    [bookings]
  );

  const revenueToday = useMemo(
    () => completedBookings.reduce((acc, b) => acc + priceToNumber(b.price), 0),
    [completedBookings]
  );

  const outstandingPayments = useMemo(
    () => completedBookings.filter((b) => b.paymentStatus !== "Paid"),
    [completedBookings]
  );

  const activeCount = useMemo(
    () => bookings.filter((b) => ACTIVE_STATUSES.includes(b.status)).length,
    [bookings]
  );

  const next5 = upcoming.slice(0, 5);

  // ─── Action Required ───────────────────────────────────────────────────────

  const actionItems = useMemo(() => {
    const items = [];
    if (unassignedCount > 0) {
      items.push({
        key: "unassigned",
        icon: UserPlus,
        title: `${unassignedCount} unassigned booking${unassignedCount === 1 ? "" : "s"}`,
        description: "Assign a driver to dispatch these jobs",
        count: unassignedCount,
        accent: "red",
        onClick: () => router.push("/operator/dispatch"),
      });
    }
    if (calls.length > 0) {
      items.push({
        key: "missed-calls",
        icon: PhoneMissed,
        title: `${calls.length} missed call${calls.length === 1 ? "" : "s"} awaiting follow-up`,
        description: "Review and recover potential bookings",
        count: calls.length,
        accent: "amber",
        onClick: () => router.push("/operator/bookings"),
      });
    }
    if (outstandingPayments.length > 0) {
      items.push({
        key: "payments",
        icon: CreditCard,
        title: `${outstandingPayments.length} completed job${outstandingPayments.length === 1 ? "" : "s"} with outstanding payment`,
        description: "Chase payment or mark as paid",
        count: outstandingPayments.length,
        accent: "blue",
        onClick: () => router.push("/operator/dispatch"),
      });
    }
    return items;
  }, [unassignedCount, calls, outstandingPayments, router]);

  // ─── Quick actions ──────────────────────────────────────────────────────────

  const quickActions = useMemo(
    () => [
      { key: "new-booking", label: "New Booking", icon: Plus, onClick: () => setModalOpen(true) },
      { key: "dispatch", label: "Dispatch Board", icon: LayoutGrid, onClick: () => router.push("/operator/dispatch") },
      { key: "drivers", label: "Driver Fleet", icon: Users, onClick: () => router.push("/operator/drivers") },
    ],
    [router]
  );

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handleCreateBooking = useCallback(
    async (form) => {
      const result = await createBooking(form);
      toast({ message: `Booking ${result.ref} created successfully`, type: "success" });
      return result;
    },
    [createBooking, toast]
  );

  const handleStartDispatch = useCallback(
    async (booking) => {
      try {
        await updateStatus(booking.id, "En Route");
        toast({ message: `${booking.id} is now En Route`, type: "success" });
      } catch (err) {
        toast({ message: err?.message ?? "Failed to update status", type: "error" });
      }
    },
    [updateStatus, toast]
  );

  const handleStatusUpdate = useCallback(
    async (id, status) => {
      try {
        await updateStatus(id, status);
        toast({ message: `Status → ${status}`, type: "success" });
      } catch (err) {
        toast({ message: err?.message ?? "Failed to update status", type: "error" });
      }
    },
    [updateStatus, toast]
  );

  const handleStatusOverride = useCallback(
    async (id, status) => {
      try {
        await updateStatusOverride(id, status);
        toast({ message: `Status → ${status}`, type: "success" });
      } catch (err) {
        toast({ message: err?.message ?? "Failed to update status", type: "error" });
      }
    },
    [updateStatusOverride, toast]
  );

  const handleAssignDriver = useCallback(
    async (id, driverId) => {
      const driver = drivers.find((d) => d.id === driverId);
      try {
        await assignDriver(id, driverId, driver?.name ?? null);
        toast({ message: driver ? `Assigned to ${driver.name}` : "Driver unassigned", type: "success" });
      } catch (err) {
        toast({ message: err?.message ?? "Failed to assign driver", type: "error" });
      }
    },
    [assignDriver, drivers, toast]
  );

  const handleUpdateNotes = useCallback(
    async (id, notes) => {
      try {
        await updateNotes(id, notes);
      } catch (err) {
        toast({ message: err?.message ?? "Failed to update notes", type: "error" });
      }
    },
    [updateNotes, toast]
  );

  const handleTogglePriority = useCallback(
    async (id) => {
      try {
        await togglePriority(id);
      } catch (err) {
        toast({ message: err?.message ?? "Failed to update priority", type: "error" });
      }
    },
    [togglePriority, toast]
  );

  const handleUpdatePaymentStatus = useCallback(
    async (id, ps) => {
      try {
        await updatePaymentStatus(id, ps);
      } catch (err) {
        toast({ message: err?.message ?? "Failed to update payment status", type: "error" });
      }
    },
    [updatePaymentStatus, toast]
  );

  const liveSelectedBooking = useMemo(() => {
    if (!selectedBooking) return null;
    return bookings.find((b) => b.id === selectedBooking.id) ?? selectedBooking;
  }, [selectedBooking, bookings]);

  return (
    <>
      <BookingModal open={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreateBooking} />

      {liveSelectedBooking && (
        <BookingDetailDrawer
          booking={liveSelectedBooking}
          drivers={drivers}
          onClose={() => setSelectedBooking(null)}
          onUpdateStatus={handleStatusOverride}
          onAssignDriver={handleAssignDriver}
          onUpdateNotes={handleUpdateNotes}
          onTogglePriority={handleTogglePriority}
          onUpdatePaymentStatus={handleUpdatePaymentStatus}
        />
      )}

      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-10">
        {bookingsError && (
          <div className="rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-300">
            Failed to load bookings: {bookingsError}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Command Centre</p>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Today&apos;s operations</h1>
            <p className="mt-1 text-sm text-slate-500">{today}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${operational.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${operational.dot}`} />
              {operational.label}
            </span>
            <RealtimeDot />
            <LiveClock />
            <button
              onClick={() => setModalOpen(true)}
              className="flex h-11 items-center gap-2 rounded-2xl bg-amber-500 px-4 text-sm font-semibold text-black transition hover:bg-amber-400"
            >
              <Plus className="h-4 w-4" />
              New Booking
            </button>
          </div>
        </div>

        {/* Stat tiles */}
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <StatCard
            icon={Calendar}
            label="Today's Transfers"
            value={bookings.length}
            sub={`${activeCount} active now`}
            accent="gold"
            onClick={() => router.push("/operator/dispatch")}
          />
          <StatCard
            icon={UserPlus}
            label="Unassigned Jobs"
            value={unassignedCount}
            sub={unassignedCount > 0 ? "Needs driver assignment" : "All jobs assigned"}
            accent={unassignedCount > 0 ? "red" : "emerald"}
            onClick={() => router.push("/operator/dispatch")}
          />
          <StatCard
            icon={Clock}
            label="Next Pickup"
            value={nextPickup ? nextPickup.time : "—"}
            sub={nextPickup ? `${nextPickup.customer} · ${nextPickup.route}` : "No upcoming pickups"}
            accent="blue"
          />
          <StatCard
            icon={PoundSterling}
            label="Revenue Today"
            value={`£${revenueToday.toLocaleString()}`}
            sub={`${completedBookings.length} completed job${completedBookings.length === 1 ? "" : "s"}`}
            accent="emerald"
          />
        </section>

        {/* Action required */}
        <ActionRequiredPanel items={actionItems} />

        {/* Next 5 transfers */}
        <section className="card rounded-2xl p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Live Dispatch</p>
              <h2 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Next 5 Transfers</h2>
            </div>
            <button
              onClick={() => router.push("/operator/dispatch")}
              className="min-h-[36px] px-2 text-xs text-slate-500 transition hover:text-amber-300"
            >
              View all →
            </button>
          </div>

          {bookingsLoading && bookings.length === 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <TransferCardSkeleton key={i} />
              ))}
            </div>
          ) : next5.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No upcoming transfers"
              message="New bookings will appear here as they come in."
              actionLabel="New Booking"
              onAction={() => setModalOpen(true)}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {next5.map((booking) => (
                <TransferCard
                  key={booking.id}
                  booking={booking}
                  compact
                  onOpenDetail={setSelectedBooking}
                  onStartDispatch={handleStartDispatch}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <QuickActionMenu actions={quickActions} />
    </>
  );
}
