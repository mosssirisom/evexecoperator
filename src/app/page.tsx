"use client";

import { useMemo, useState } from "react";
import { format, parseISO, isSameDay, isSameMonth } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  Download,
  ExternalLink,
  History,
  Inbox,
  LayoutList,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import type { DbBooking, BookingStatus, DbQuoteRequest } from "@/lib/database.types";
import { QUOTE_REQUEST_STATUS, CONTACT_MESSAGE_STATUS, STATUS_TRANSITIONS } from "@/lib/database.types";
import { useBookings } from "@/hooks/useBookings";
import { useDrivers } from "@/hooks/useDrivers";
import { useQuoteRequests } from "@/hooks/useQuoteRequests";
import { useMissedCalls } from "@/hooks/useMissedCalls";
import { useContactMessages } from "@/hooks/useContactMessages";
import { useNotifications } from "@/hooks/useNotifications";
import { useDriverAvailability } from "@/hooks/useDriverAvailability";
import { useAuditLog } from "@/hooks/useAuditLog";
import { useToast } from "@/hooks/useToast";
import { useAuth } from "@/hooks/useAuth";
import { CLASH_BUFFER_MINUTES, timeToMinutes, quoteToPrefill } from "@/lib/bookingUtils";
import { bookingsToCsv, downloadCsv } from "@/lib/csv";

import Header from "@/components/Header";
import CalendarView from "@/components/CalendarView";
import DailyView from "@/components/DailyView";
import StatsBar from "@/components/StatsBar";
import AddBookingModal, { type BookingPrefill } from "@/components/AddBookingModal";
import StatusBadge from "@/components/StatusBadge";
import InboxTab from "@/components/InboxTab";
import AuditLogTab from "@/components/AuditLogTab";
import LoginScreen from "@/components/LoginScreen";
import DriverLiveBadge from "@/components/DriverLiveBadge";
import { useDriverLocations } from "@/hooks/useDriverLocations";

type Tab = "calendar" | "transfers" | "fleet" | "inbox" | "activity";

const ALL_BOOKING_STATUSES = Object.keys(STATUS_TRANSITIONS) as BookingStatus[];

export default function Page() {
  const { session, loading: authLoading, signIn, signOut } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-navy-900 flex items-center justify-center text-slate-600 text-sm gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />
        Loading…
      </div>
    );
  }

  if (!session) return <LoginScreen onSignIn={signIn} />;

  return <Dashboard onSignOut={signOut} />;
}

function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const { bookings, loading, error, updateStatus, assignDriver, createBooking, deleteBooking } = useBookings();
  const { drivers } = useDrivers();
  const { locations: driverLocations } = useDriverLocations();
  const { quoteRequests, setStatus: setQuoteStatus } = useQuoteRequests();
  const { missedCalls, setResolved: setMissedCallResolved } = useMissedCalls();
  const { contactMessages, setStatus: setContactMessageStatus } = useContactMessages();
  const { notifications } = useNotifications();
  const { unavailableDates, unavailableDriverIds } = useDriverAvailability();
  const { entries: auditLogEntries } = useAuditLog();
  const { showToast } = useToast();

  const [currentMonth, setMonth] = useState<Date>(new Date());
  const [selectedDate, setDate] = useState<Date | null>(new Date());
  const [activeTab, setTab] = useState<Tab>("calendar");
  const [showAddModal, setAdd] = useState(false);
  const [quotePrefill, setQuotePrefill] = useState<{ prefill: BookingPrefill; quoteId: string } | null>(null);
  const [transferQuery, setTransferQuery] = useState("");
  const [transferStatusFilter, setTransferStatusFilter] = useState<BookingStatus | "all">("all");
  const [dangerTarget, setDangerTarget] = useState<DbBooking | null>(null);
  const [dangerPassword, setDangerPassword] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);

  const inboxCount = useMemo(() => {
    const newQuotes = quoteRequests.filter((q) => !q.status || q.status === "new").length;
    const unresolvedCalls = missedCalls.filter((c) => !c.resolved).length;
    const unreadMessages = contactMessages.filter((m) => m.status !== "read").length;
    return newQuotes + unresolvedCalls + unreadMessages;
  }, [quoteRequests, missedCalls, contactMessages]);

  const dayBookings = useMemo(() => {
    if (!selectedDate) return [];
    return bookings.filter((b) => b.travel_date && isSameDay(parseISO(b.travel_date), selectedDate));
  }, [bookings, selectedDate]);

  const monthStats = useMemo(() => {
    const month = bookings.filter((b) => {
      if (!b.travel_date) return false;
      return isSameMonth(parseISO(b.travel_date), currentMonth) && b.status !== "Cancelled";
    });
    const revenue = month.reduce((s, b) => s + (b.quoted_price ?? 0), 0);
    const destinations = new Set(month.map((b) => b.dropoff_address).filter(Boolean)).size;
    const unassigned = month.filter((b) => b.status === "Unassigned" || b.status === "Unassigned / Missed Call Recovery").length;
    return { bookingCount: month.length, unassignedCount: unassigned, destinationCount: destinations, revenue };
  }, [bookings, currentMonth]);

  const upcomingBookings = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return [...bookings]
      .filter((b) => b.travel_date && b.travel_date >= today && b.status !== "Cancelled")
      .sort((a, b) => `${a.travel_date}T${a.travel_time ?? "00:00"}`.localeCompare(`${b.travel_date}T${b.travel_time ?? "00:00"}`));
  }, [bookings]);

  const filteredTransfers = useMemo(() => {
    const q = transferQuery.trim().toLowerCase();
    return upcomingBookings.filter((b) => {
      if (transferStatusFilter !== "all" && b.status !== transferStatusFilter) return false;
      if (!q) return true;
      const haystack = [b.ref, b.customer_name, b.customer_phone, b.customer_email, b.airport, b.dropoff_address, b.flight_number, b.drivers?.name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [upcomingBookings, transferQuery, transferStatusFilter]);

  const handleStatusChange = async (ref: string, status: BookingStatus) => {
    const ok = await updateStatus(ref, status);
    if (!ok) showToast("Couldn't update status — check connection and try again", "error");
  };

  const handleDriverAssign = async (ref: string, driverId: string | null) => {
    if (driverId) {
      const booking = bookings.find((b) => b.ref === ref);
      if (booking?.travel_date) {
        if (unavailableDriverIds(booking.travel_date).has(driverId)) {
          const driverName = drivers.find((d) => d.id === driverId)?.name ?? "This driver";
          showToast(`${driverName} has marked ${booking.travel_date} as unavailable`, "warning");
          return;
        }
        const bookingMinutes = timeToMinutes(booking.travel_time);
        const clash = bookings.find((b) => {
          if (b.ref === ref) return false;
          if (b.driver_id !== driverId) return false;
          if (b.travel_date !== booking.travel_date) return false;
          if (["Completed", "Cancelled"].includes(b.status)) return false;
          const otherMinutes = timeToMinutes(b.travel_time);
          if (bookingMinutes == null || otherMinutes == null) return true;
          return Math.abs(otherMinutes - bookingMinutes) < CLASH_BUFFER_MINUTES;
        });
        if (clash) {
          const clashTime = clash.travel_time?.slice(0, 5) ?? "an unscheduled time";
          showToast(`Clash: driver already has a job at ${clashTime} on ${clash.travel_date} (within ${CLASH_BUFFER_MINUTES}-min buffer)`, "warning");
          return;
        }
      }
    }
    const ok = await assignDriver(ref, driverId);
    if (!ok) showToast("Couldn't update driver assignment — check connection and try again", "error");
  };

  const handleAddBooking = async (data: Omit<DbBooking, "id" | "ref" | "created_at" | "updated_at" | "drivers">) => {
    try {
      const ref = await createBooking(data);
      showToast(`Booking ${ref} created`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create booking", "error");
      return;
    }
    if (quotePrefill) {
      await setQuoteStatus(quotePrefill.quoteId, QUOTE_REQUEST_STATUS.CONVERTED);
      setQuotePrefill(null);
    }
    setAdd(false);
    if (data.travel_date) {
      const d = parseISO(data.travel_date);
      setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      setDate(d);
      setTab("calendar");
    }
  };

  const handleDismissQuote = async (id: string) => {
    const ok = await setQuoteStatus(id, QUOTE_REQUEST_STATUS.DISMISSED);
    if (!ok) showToast("Couldn't dismiss quote — check connection and try again", "error");
  };

  const handleConvertQuote = (quote: DbQuoteRequest) => {
    setQuotePrefill({ prefill: quoteToPrefill(quote), quoteId: quote.id });
    setAdd(true);
  };

  const handleToggleMissedCall = async (id: string, resolved: boolean) => {
    const ok = await setMissedCallResolved(id, resolved);
    if (!ok) showToast("Couldn't update missed call — check connection and try again", "error");
  };

  const handleToggleContactMessage = async (id: string, read: boolean) => {
    const ok = await setContactMessageStatus(id, read ? CONTACT_MESSAGE_STATUS.READ : CONTACT_MESSAGE_STATUS.NEW);
    if (!ok) showToast("Couldn't update message — check connection and try again", "error");
  };

  const openDangerFlow = (booking: DbBooking) => {
    setDangerTarget(booking);
    setDangerPassword("");
  };

  const closeDangerFlow = () => {
    if (dangerBusy) return;
    setDangerTarget(null);
    setDangerPassword("");
  };

  const confirmDangerAction = async () => {
    if (!dangerTarget) return;
    setDangerBusy(true);
    try {
      await deleteBooking(dangerTarget.ref, dangerPassword);
      showToast(`Booking ${dangerTarget.ref} removed`, "success");
      setDangerTarget(null);
      setDangerPassword("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not remove booking", "error");
    } finally {
      setDangerBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col">
      <div className="relative z-30 bg-navy-900 border-b border-white/5">
        <Header onNewBooking={() => setAdd(true)} onSignOut={onSignOut} />
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-white/5">
          {error ? (
            <><WifiOff size={10} className="text-red-400" /><span className="text-[10px] text-red-400">Offline — showing cached data</span></>
          ) : (
            <><Wifi size={10} className="text-emerald-400" /><span className="text-[10px] text-emerald-500">Live sync · evexec.co.uk</span></>
          )}
        </div>
        <nav className="flex overflow-x-auto px-4 gap-1 py-2">
          {([
            { id: "calendar", label: "Calendar", icon: CalendarDays },
            { id: "transfers", label: "Transfers", icon: LayoutList },
            { id: "inbox", label: "Inbox", icon: Inbox },
            { id: "fleet", label: "Fleet", icon: Users },
            { id: "activity", label: "Activity", icon: History },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 ${activeTab === id ? "bg-gold/15 text-gold border border-gold/25" : "text-slate-500 hover:text-slate-300"}`}>
              <Icon size={12} />{label}
              {id === "inbox" && inboxCount > 0 && <span className="flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-[10px] font-bold text-white">{inboxCount}</span>}
            </button>
          ))}
        </nav>
      </div>

      {loading && <div className="flex items-center justify-center py-12 text-slate-600 text-sm gap-2"><span className="w-4 h-4 rounded-full border-2 border-gold/30 border-t-gold animate-spin" />Loading live data…</div>}

      {!loading && (
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
            {activeTab === "calendar" && (
              <>
                <CalendarView currentMonth={currentMonth} bookings={bookings} selectedDate={selectedDate} onDateSelect={(d) => { setDate(d); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }} onMonthChange={setMonth} />
                <StatsBar stats={monthStats} />
                {selectedDate && (
                  <DailyView
                    date={selectedDate}
                    bookings={dayBookings}
                    drivers={drivers}
                    notifications={notifications}
                    unavailableDriverIds={unavailableDriverIds(format(selectedDate, "yyyy-MM-dd"))}
                    onStatusChange={handleStatusChange}
                    onDriverAssign={handleDriverAssign}
                    onDangerAction={openDangerFlow}
                  />
                )}
                <button onClick={() => setTab("transfers")} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border border-gold/20 bg-navy-800 text-sm font-semibold text-gold hover:bg-gold/10 hover:border-gold/40 active:scale-[0.99] transition-all shadow-card">
                  <CalendarDays size={15} />View Upcoming Transfers
                </button>
              </>
            )}

            {activeTab === "transfers" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-100">Upcoming Transfers</h2><span className="text-xs text-slate-500">{filteredTransfers.length} of {upcomingBookings.length}</span></div>
                <div className="flex gap-2">
                  <div className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" /><input type="text" value={transferQuery} onChange={(e) => setTransferQuery(e.target.value)} placeholder="Search name, phone, ref, flight…" className="w-full bg-navy-800 border border-white/8 rounded-xl pl-8 pr-8 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-colors" />{transferQuery && <button type="button" onClick={() => setTransferQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"><X size={14} /></button>}</div>
                  <select value={transferStatusFilter} onChange={(e) => setTransferStatusFilter(e.target.value as BookingStatus | "all")} className="bg-navy-800 border border-white/8 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-colors shrink-0"><option value="all">All statuses</option>{ALL_BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select>
                  <button type="button" onClick={() => downloadCsv(`transfers-${format(new Date(), "yyyy-MM-dd")}.csv`, bookingsToCsv(filteredTransfers))} disabled={filteredTransfers.length === 0} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/8 bg-navy-800 text-xs font-semibold text-slate-300 hover:text-gold hover:border-gold/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"><Download size={13} />Export</button>
                </div>
                {filteredTransfers.length === 0 ? <div className="flex flex-col items-center py-12 text-slate-600"><LayoutList size={32} className="mb-2 text-slate-700" /><p className="text-sm">{upcomingBookings.length === 0 ? "No upcoming transfers" : "No transfers match your search"}</p></div> : filteredTransfers.map((b) => (
                  <div key={b.ref} className="rounded-2xl border border-white/8 bg-navy-800 px-4 py-3 flex items-center gap-3 shadow-card">
                    <div className="text-center min-w-[44px]"><div className="text-base font-bold text-slate-100">{b.travel_time?.slice(0, 5) ?? "—"}</div><div className="text-[10px] text-slate-600">{b.travel_date?.slice(5) ?? ""}</div></div>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-200 truncate">{b.customer_name}</p><p className="text-xs text-slate-500 truncate">{(b.airport ?? "").split(",")[0]} → {(b.dropoff_address ?? "").split(",")[0]}</p>{b.flight_number && <p className="text-[10px] text-blue-400 font-mono mt-0.5">{b.flight_number}</p>}</div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0"><span className="text-xs font-bold text-gold">{b.quoted_price != null ? `£${b.quoted_price}` : "TBC"}</span><StatusBadge status={b.status} compact /><button type="button" onClick={() => openDangerFlow(b)} className="mt-1 flex items-center gap-1 rounded-lg border border-red-400/20 bg-red-500/10 px-2 py-1 text-[10px] font-semibold text-red-300 hover:bg-red-500/20"><Trash2 size={11} />Remove</button></div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "inbox" && <InboxTab quoteRequests={quoteRequests} missedCalls={missedCalls} contactMessages={contactMessages} onDismissQuote={handleDismissQuote} onConvertQuote={handleConvertQuote} onToggleMissedCall={handleToggleMissedCall} onToggleContactMessage={handleToggleContactMessage} />}
            {activeTab === "activity" && <AuditLogTab entries={auditLogEntries} />}
            {activeTab === "fleet" && (
              <div className="space-y-3"><h2 className="text-lg font-bold text-slate-100">Fleet</h2>{drivers.map((d) => { const active = bookings.filter((b) => b.driver_id === d.id && !["Completed", "Cancelled"].includes(b.status)).length; const completed = bookings.filter((b) => b.driver_id === d.id && b.status === "Completed").length; const revenue = bookings.filter((b) => b.driver_id === d.id && b.status === "Completed").reduce((s, b) => s + (b.quoted_price ?? 0), 0); const today = format(new Date(), "yyyy-MM-dd"); const offToday = unavailableDriverIds(today).has(d.id); const upcomingDaysOff = unavailableDates.filter((u) => u.driver_id === d.id && u.date >= today).length; return <div key={d.id} className="rounded-2xl border border-white/8 bg-navy-800 px-4 py-4 shadow-card"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-full bg-navy-700 border border-gold/20 flex items-center justify-center text-sm font-bold text-gold shrink-0">{d.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}</div><div className="flex-1 min-w-0"><p className="font-semibold text-slate-100 text-sm">{d.name}</p><p className="text-xs text-slate-500 mt-0.5">{d.vehicle ?? "—"}</p>{d.plate && <p className="text-xs text-slate-600 font-mono mt-0.5">{d.plate}</p>}</div><div className="flex flex-col items-end gap-1 shrink-0"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.status === "active" || d.status === "Available" ? "bg-emerald-900/40 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>{d.status ?? "—"}</span><DriverLiveBadge location={driverLocations[d.id]} />{offToday && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-900/40 text-red-400">Off today</span>}{active > 0 && <span className="text-xs text-gold font-medium">{active} active</span>}</div></div>{upcomingDaysOff > 0 && <p className="text-[10px] text-slate-500 mt-2">{upcomingDaysOff} upcoming day{upcomingDaysOff === 1 ? "" : "s"} off booked</p>}<div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/5"><div className="text-center"><div className="text-sm font-bold text-slate-200">{completed}</div><div className="text-[10px] text-slate-600 mt-0.5">Completed</div></div><div className="text-center"><div className="text-sm font-bold text-gold">£{revenue.toLocaleString()}</div><div className="text-[10px] text-slate-600 mt-0.5">Revenue</div></div></div></div>; })}<div className="rounded-2xl border border-white/8 bg-navy-800 px-4 py-4 space-y-2 shadow-card"><p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">EV Exec Ecosystem</p>{[{ label: "EV Exec Main Site", href: "https://evexec.co.uk" }, { label: "Driver App", href: "https://evexecdriverapp.vercel.app" }, { label: "Operator Portal", href: "https://evexecoperator.vercel.app" }].map((link) => <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-navy-700 hover:bg-navy-600 border border-white/5 hover:border-gold/20 transition-all group"><span className="text-sm text-slate-300 group-hover:text-gold transition-colors">{link.label}</span><ExternalLink size={13} className="text-slate-600 group-hover:text-gold/60 transition-colors" /></a>)}</div></div>
            )}
          </div>
        </main>
      )}

      {showAddModal && <AddBookingModal drivers={drivers} defaultDate={selectedDate ?? new Date()} prefill={quotePrefill?.prefill} onSave={handleAddBooking} onClose={() => { setAdd(false); setQuotePrefill(null); }} />}
      {dangerTarget && <PasswordConfirmModal booking={dangerTarget} password={dangerPassword} busy={dangerBusy} onPasswordChange={setDangerPassword} onCancel={closeDangerFlow} onConfirm={confirmDangerAction} />}
    </div>
  );
}

function PasswordConfirmModal({ booking, password, busy, onPasswordChange, onCancel, onConfirm }: { booking: DbBooking; password: string; busy: boolean; onPasswordChange: (value: string) => void; onCancel: () => void; onConfirm: () => void; }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-red-400/20 bg-navy-900 p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-500/10 text-red-300"><ShieldCheck size={20} /></div>
          <div><h2 className="text-lg font-bold text-white">Confirm job removal</h2><p className="mt-1 text-sm text-slate-400">For security, re-enter your operator password before removing this booking.</p></div>
        </div>
        <div className="mt-4 rounded-2xl border border-white/8 bg-navy-800 p-3 text-sm"><p className="font-semibold text-slate-100">{booking.customer_name}</p><p className="mt-1 text-xs text-slate-500">{booking.ref} · {booking.travel_date ?? "No date"} {booking.travel_time?.slice(0, 5) ?? ""}</p></div>
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-200 flex gap-2"><AlertTriangle size={15} className="shrink-0" />This action permanently removes the job from the operator calendar and driver view.</div>
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-500">Operator password</label>
        <input type="password" value={password} onChange={(e) => onPasswordChange(e.target.value)} autoFocus className="mt-2 w-full rounded-2xl border border-white/10 bg-navy-800 px-4 py-3 text-sm text-white outline-none focus:border-gold/50" placeholder="Enter password" />
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} disabled={busy} className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:border-white/20 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy || !password.trim()} className="flex-1 rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/25 disabled:opacity-50">{busy ? "Verifying…" : "Remove job"}</button>
        </div>
      </div>
    </div>
  );
}
