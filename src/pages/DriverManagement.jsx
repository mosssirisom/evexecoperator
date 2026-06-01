import React, { useState } from "react";
import {
  Car,
  Phone,
  Star,
  CheckCircle2,
  Clock,
  UserX,
  MoreVertical,
  Plus,
} from "lucide-react";
import { drivers } from "../data/mockData";

function statusColor(status) {
  if (status === "Available") return "text-emerald-300 bg-emerald-400/10 border-emerald-400/20";
  if (status === "En route" || status === "Passenger onboard")
    return "text-blue-300 bg-blue-400/10 border-blue-400/20";
  if (status === "Available soon")
    return "text-amber-300 bg-amber-400/10 border-amber-400/20";
  return "text-slate-400 bg-slate-500/10 border-slate-500/20";
}

function DriverCard({ driver }) {
  return (
    <div className="card p-6 flex flex-col gap-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/10 text-xl font-semibold text-amber-300">
            {driver.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div>
            <h3 className="font-semibold text-white">{driver.name}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{driver.plate}</p>
          </div>
        </div>
        <button className="text-slate-600 hover:text-slate-400 transition">
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>

      <span
        className={`self-start rounded-full border px-3 py-1 text-xs font-medium ${statusColor(
          driver.status
        )}`}
      >
        {driver.status}
      </span>

      <div className="space-y-3 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <Car className="h-4 w-4 text-slate-600" />
          {driver.vehicle}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Phone className="h-4 w-4 text-slate-600" />
          {driver.phone}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="h-4 w-4 text-slate-600" />
          Current: {driver.job}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{driver.completedToday}</p>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Today</p>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <p className="text-lg font-semibold text-white">{driver.rating}</p>
          </div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-600">Rating</p>
        </div>
        <button className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:border-amber-400/20 hover:text-amber-300">
          Assign Job
        </button>
      </div>
    </div>
  );
}

export default function DriverManagement() {
  const available = drivers.filter((d) =>
    ["Available", "Available soon"].includes(d.status)
  ).length;
  const active = drivers.filter((d) =>
    ["En route", "Passenger onboard"].includes(d.status)
  ).length;

  return (
    <div className="grid gap-6 p-10">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Total Drivers", value: drivers.length, icon: CheckCircle2, color: "text-white" },
          { label: "On Job", value: active, icon: Car, color: "text-blue-300" },
          { label: "Available", value: available, icon: CheckCircle2, color: "text-emerald-300" },
          { label: "Off Duty", value: 0, icon: UserX, color: "text-slate-400" },
        ].map((s) => (
          <div key={s.label} className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <span className="text-[10px] uppercase tracking-[0.2em] text-slate-600">
                Live
              </span>
            </div>
            <p className={`text-3xl font-semibold ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Fleet</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">Active Drivers</h2>
        </div>
        <button className="flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400">
          <Plus className="h-4 w-4" />
          Add Driver
        </button>
      </div>

      {/* Driver cards */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {drivers.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
      </div>

      {/* Shift schedule placeholder */}
      <div className="card p-6">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Schedule</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Today's Shift Overview</h2>
        </div>
        <div className="relative h-24 overflow-hidden rounded-2xl bg-white/[0.02]">
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-slate-600">
              Shift timeline — Phase 4 (real-time Supabase data)
            </p>
          </div>
          {/* Decorative bars */}
          {drivers.map((d, i) => (
            <div
              key={d.id}
              className="absolute h-4 rounded-full bg-amber-400/20"
              style={{
                top: `${8 + i * 14}px`,
                left: `${10 + i * 8}%`,
                width: `${30 + i * 10}%`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
