import React, { useState } from "react";
import {
  Bot,
  PhoneMissed,
  Phone,
  Clock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Zap,
} from "lucide-react";
import { missedCalls } from "../data/mockData";

const automations = [
  {
    id: "AUTO-01",
    name: "Missed Call SMS Recovery",
    trigger: "Missed inbound call",
    action: "Send SMS with booking link within 2 min",
    status: "Active",
    triggered: 4,
    converted: 1,
  },
  {
    id: "AUTO-02",
    name: "Incomplete Enquiry Follow-up",
    trigger: "Web form partial submission",
    action: "Email follow-up after 15 min",
    status: "Active",
    triggered: 2,
    converted: 0,
  },
  {
    id: "AUTO-03",
    name: "Flight Delay Monitor",
    trigger: "Flight status change detected",
    action: "Alert driver + update pickup time",
    status: "Active",
    triggered: 1,
    converted: 1,
  },
  {
    id: "AUTO-04",
    name: "Post-Trip Review Request",
    trigger: "Job marked Completed",
    action: "Send review request SMS 30 min after",
    status: "Paused",
    triggered: 12,
    converted: 8,
  },
];

function AutomationCard({ automation }) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-5 transition hover:border-amber-400/10 hover:bg-white/[0.03]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-400/10">
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
            automation.status === "Active"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : "border-slate-500/30 bg-slate-500/10 text-slate-400"
          }`}
        >
          {automation.status}
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
      <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-500">
        <span>Triggered today: <span className="text-white">{automation.triggered}</span></span>
        <span>Converted: <span className="text-emerald-300">{automation.converted}</span></span>
      </div>
    </div>
  );
}

function MissedCallRow({ call }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-red-500/10">
          <PhoneMissed className="h-4 w-4 text-red-300" />
        </div>
        <div>
          <p className="font-medium text-white">{call.caller}</p>
          <p className="mt-0.5 text-xs text-slate-500">{call.notes}</p>
        </div>
      </div>
      <div className="flex items-center gap-6 text-right">
        <div>
          <p className="text-xs text-slate-600">Time</p>
          <p className="text-sm text-white">{call.time}</p>
        </div>
        <div>
          <p className="text-xs text-slate-600">Attempts</p>
          <p className="text-sm text-white">{call.attempts}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300 transition hover:bg-emerald-400/20">
            <Phone className="h-3.5 w-3.5" />
            Call
          </button>
          <button className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-400 transition hover:border-amber-400/20 hover:text-amber-300">
            Book
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AutomatedBookings() {
  const [activeTab, setActiveTab] = useState("queue");

  return (
    <div className="grid gap-6 p-10">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Automations Active", value: "3", icon: Bot, color: "text-amber-300" },
          { label: "Triggered Today", value: "7", icon: Zap, color: "text-blue-300" },
          { label: "Recovered Bookings", value: "1", icon: CheckCircle2, color: "text-emerald-300" },
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
      <div className="flex gap-2 border-b border-white/5 pb-0">
        {[
          { key: "queue", label: "Missed Call Queue" },
          { key: "automations", label: "Automations" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-4 pr-6 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-amber-400 text-amber-300"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "queue" && (
        <div className="card p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
                Recovery Queue
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Missed Calls
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {missedCalls.length} calls awaiting follow-up
              </p>
            </div>
            <button className="flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
          <div className="space-y-3">
            {missedCalls.map((call) => (
              <MissedCallRow key={call.id} call={call} />
            ))}
          </div>
        </div>
      )}

      {activeTab === "automations" && (
        <div>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-amber-400">
                Workflows
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                Active Automations
              </h2>
            </div>
            <button className="flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400">
              <Zap className="h-4 w-4" />
              New Automation
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
  );
}
