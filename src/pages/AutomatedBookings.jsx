import React, { useCallback, useState } from "react";
import {
  Bot,
  PhoneMissed,
  Phone,
  RefreshCw,
  AlertTriangle,
  Zap,
  Plus,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { useMissedCalls } from "../hooks/useMissedCalls";
import { useBookings } from "../hooks/useBookings";
import { useToast } from "../components/Toast";
import BookingModal from "../components/BookingModal";
import { sendSms, missedCallRecoverySms } from "../lib/edgeFunctions";

const automations = [
  {
    id: "AUTO-01",
    name: "Missed Call SMS Recovery",
    trigger: "Missed inbound call appears in the queue below",
    action: "Operator clicks \"Send SMS\" to text a booking link to the caller",
    mode: "manual",
  },
  {
    id: "AUTO-02",
    name: "Incomplete Enquiry Follow-up",
    trigger: "Web form partial submission",
    action: "Email follow-up after 15 min",
    mode: "planned",
  },
  {
    id: "AUTO-03",
    name: "Flight Delay Monitor",
    trigger: "Operator opens a booking with a flight number",
    action: "Click \"Check Flight\" to pull live status from AeroDataBox",
    mode: "manual",
  },
  {
    id: "AUTO-04",
    name: "Post-Trip Review Request",
    trigger: "Job marked Completed",
    action: "Send review request SMS 30 min after",
    mode: "planned",
  },
];

function AutomationCard({ automation }) {
  const isManual = automation.mode === "manual";

  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-amber-400/10 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-400/10">
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            isManual
              ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
              : "border-slate-500/30 bg-slate-500/10 text-slate-400"
          }`}
          title={isManual ? "Triggered manually by an operator" : "Not yet implemented"}
        >
          {isManual ? "Manual Trigger" : "Planned"}
        </span>
      </div>
      <h3 className="mt-4 font-semibold text-white">{automation.name}</h3>
      <div className="mt-3 space-y-2">
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <span className="mt-0.5 font-medium text-slate-600">Trigger:</span>
          {automation.trigger}
        </div>
        <div className="flex items-start gap-2 text-xs text-slate-500">
          <span className="mt-0.5 font-medium text-slate-600">Action:</span>
          {automation.action}
        </div>
      </div>
    </div>
  );
}

function MissedCallRow({ call, onResolve, onBook }) {
  const [smsPending, setSmsPending] = useState(false);
  const [smsStatus, setSmsStatus] = useState(null); // "sent" | "unconfigured" | "error"

  const handleSendSms = useCallback(async () => {
    if (smsPending) return;
    setSmsPending(true);
    setSmsStatus(null);
    const result = await sendSms({ to: call.caller, message: missedCallRecoverySms(), bookingRef: call.id });
    setSmsPending(false);
    if (result.ok) setSmsStatus("sent");
    else if (!result.configured) setSmsStatus("unconfigured");
    else setSmsStatus("error");
  }, [call, smsPending]);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-red-500/10">
          <PhoneMissed className="h-4 w-4 text-red-300" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-white">{call.caller}</p>
          <p className="mt-0.5 truncate text-xs text-slate-500">{call.notes}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6">
        <div className="text-left sm:text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Time</p>
          <p className="text-sm text-white">{call.time}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Attempts</p>
          <p className="text-sm text-white">{call.attempts}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`tel:${call.caller.replace(/\s/g, "")}`}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-400/20"
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </a>
          <button
            onClick={handleSendSms}
            disabled={smsPending || smsStatus === "sent"}
            title={smsStatus === "unconfigured" ? "Add TWILIO_ACCOUNT_SID to Supabase secrets to enable" : "Send recovery SMS"}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs transition ${
              smsStatus === "sent"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : smsStatus === "unconfigured"
                ? "border-slate-500/30 bg-slate-500/10 text-slate-500"
                : "border-blue-400/20 bg-blue-400/10 text-blue-300 hover:bg-blue-400/20"
            }`}
          >
            {smsPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
            {smsStatus === "sent" ? "Sent!" : smsStatus === "unconfigured" ? "SMS (setup needed)" : "Send SMS"}
          </button>
          <button
            onClick={() => onBook?.(call)}
            className="flex items-center gap-1.5 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-300 transition hover:bg-amber-400/20"
          >
            <Plus className="h-3.5 w-3.5" />
            Book
          </button>
          <button
            onClick={() => onResolve?.(call.id)}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-amber-400/20 hover:text-amber-300"
          >
            Resolve
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AutomatedBookings() {
  const [activeTab, setActiveTab] = useState("queue");
  const [bookingPrefill, setBookingPrefill] = useState(null);
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const toast = useToast();
  const {
    calls: missedCalls,
    loading: callsLoading,
    error: callsError,
    resolve,
    refetch,
  } = useMissedCalls();
  const { createBooking } = useBookings();

  const manualTools = automations.filter((a) => a.mode === "manual").length;

  async function handleRefresh() {
    try {
      await refetch();
      toast({ message: "Queue refreshed", type: "info" });
    } catch {
      toast({ message: "Refresh failed", type: "error" });
    }
  }

  const handleBook = useCallback((call) => {
    setBookingPrefill({ phone: call.caller });
    setBookingModalOpen(true);
  }, []);

  const handleCreateBooking = useCallback(async (form) => {
    const result = await createBooking(form);
    toast({ message: `Booking ${result.ref} created`, type: "success" });
    return result;
  }, [createBooking, toast]);

  return (
    <>
    <BookingModal
      open={bookingModalOpen}
      onClose={() => { setBookingModalOpen(false); setBookingPrefill(null); }}
      onSubmit={handleCreateBooking}
      initialValues={bookingPrefill}
    />
    <div className="grid gap-6 p-4 sm:p-6 lg:p-10">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        {[
          { label: "Manual Tools Live", value: manualTools, icon: Bot, color: "text-amber-300" },
          { label: "Pending Review", value: missedCalls.length, icon: AlertTriangle, color: "text-red-300" },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Live</span>
            </div>
            <p className={`text-3xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/5">
        {[
          { key: "queue", label: "Missed Call Queue" },
          { key: "automations", label: "Automations" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`-mb-px border-b-2 pb-4 pr-4 text-sm font-medium transition sm:pr-6 ${
              activeTab === tab.key
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
            {tab.key === "queue" && missedCalls.length > 0 && (
              <span className="ml-2 rounded-full bg-red-500/20 px-1.5 py-0.5 text-xs text-red-300">
                {missedCalls.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Missed Call Queue ── */}
      {activeTab === "queue" && (
        <div className="card p-5 sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Recovery Queue</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Missed Calls</h2>
              <p className="mt-1 text-sm text-slate-500">
                {callsLoading
                  ? "Loading…"
                  : `${missedCalls.length} call${missedCalls.length !== 1 ? "s" : ""} awaiting follow-up`}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={callsLoading}
              className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${callsLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {callsError && (
            <div className="mb-4 rounded-2xl border border-red-400/20 bg-red-400/[0.06] px-5 py-4 text-sm text-red-300">
              Failed to load missed calls: {callsError}
            </div>
          )}

          {callsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="animate-pulse rounded-2xl border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="flex gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-white/[0.04]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/3 rounded-full bg-white/[0.04]" />
                      <div className="h-3 w-1/2 rounded-full bg-white/[0.03]" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {missedCalls.map((call) => (
                <MissedCallRow key={call.id} call={call} onResolve={resolve} onBook={handleBook} />
              ))}
              {missedCalls.length === 0 && (
                <p className="py-8 text-center text-sm text-slate-600">
                  No missed calls in the queue.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Automations ── */}
      {activeTab === "automations" && (
        <div>
          <div className="mb-6 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Workflows</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Active Automations</h2>
              <p className="mt-1 text-sm text-slate-500">
                "Manual Trigger" tools are live now and used from the booking detail view or the
                missed call queue. "Planned" automations are on the roadmap and not yet active.
              </p>
            </div>
            <button
              onClick={() =>
                toast({ message: "Custom automations coming soon", type: "info" })
              }
              className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 sm:px-5 sm:py-3"
            >
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">New Automation</span>
              <span className="sm:hidden">New</span>
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {automations.map((a) => (
              <AutomationCard key={a.id} automation={a} />
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
