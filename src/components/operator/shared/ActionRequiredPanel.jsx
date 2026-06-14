"use client";

import { CheckCircle2, ChevronRight } from "lucide-react";

const ACCENT_CLASSES = {
  red: "border-red-400/20 bg-red-400/10 text-red-300",
  amber: "border-amber-400/20 bg-amber-400/10 text-amber-300",
  blue: "border-blue-400/20 bg-blue-400/10 text-blue-300",
  slate: "border-white/10 bg-white/5 text-slate-300",
};

/**
 * Surfaces everything that needs operator attention right now:
 * unassigned bookings, pending automations, missed calls, flight delays,
 * driver conflicts, payment issues. Renders an "all clear" state when empty.
 *
 * `items`: Array<{ key, icon, title, description, count, accent, onClick }>
 */
export default function ActionRequiredPanel({ items = [] }) {
  if (items.length === 0) {
    return (
      <div className="card flex items-center gap-3 rounded-2xl p-4 sm:p-5">
        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">All clear — no urgent actions</p>
          <p className="text-xs text-slate-500">Everything is on track. New alerts will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card rounded-2xl p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">Action Required</p>
        <span className="rounded-full bg-red-400/10 px-2 py-0.5 text-[10px] font-bold text-red-300">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const Icon = item.icon;
          const accent = ACCENT_CLASSES[item.accent ?? "amber"];
          return (
            <button
              key={item.key}
              onClick={item.onClick}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-amber-400/20 hover:bg-white/[0.04]"
            >
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${accent}`}>
                {Icon && <Icon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{item.title}</p>
                {item.description && <p className="truncate text-xs text-slate-500">{item.description}</p>}
              </div>
              {item.count !== undefined && (
                <span className="flex-shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-xs font-semibold text-slate-300">
                  {item.count}
                </span>
              )}
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-600" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
