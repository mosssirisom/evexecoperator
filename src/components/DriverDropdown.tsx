"use client";

import { useState } from "react";
import { ChevronDown, User, X } from "lucide-react";
import type { DbDriver } from "@/lib/database.types";

interface Props {
  drivers: DbDriver[];
  selectedDriverId: string | null;
  unavailableDriverIds?: Set<string>;
  onAssign: (driverId: string | null) => void;
  disabled?: boolean;
}

export default function DriverDropdown({
  drivers,
  selectedDriverId,
  unavailableDriverIds,
  onAssign,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  const selected = drivers.find((d) => d.id === selectedDriverId);

  const choose = (id: string | null) => {
    onAssign(id);
    setOpen(false);
  };

  // The option list, shared by the mobile sheet and the desktop popover.
  const options = (
    <>
      <button
        onClick={() => choose(null)}
        className="w-full text-left px-4 py-3 text-sm text-slate-400 hover:bg-navy-700 hover:text-slate-200 transition-colors"
      >
        Unassigned
      </button>
      <div className="h-px bg-white/5 mx-3" />
      {drivers.map((driver) => {
        const unavailable = unavailableDriverIds?.has(driver.id) ?? false;
        return (
          <button
            key={driver.id}
            onClick={() => choose(driver.id)}
            className={`w-full text-left px-4 py-3 transition-colors ${
              driver.id === selectedDriverId ? "bg-gold/10 text-gold" : "text-slate-200 hover:bg-navy-700"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm">{driver.name}</span>
              {unavailable && (
                <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded-full">
                  Off this day
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {driver.vehicle ?? "—"}{driver.plate ? ` · ${driver.plate}` : ""}
            </div>
          </button>
        );
      })}
    </>
  );

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm
          border border-white/10 transition-all
          ${disabled
            ? "opacity-50 cursor-not-allowed bg-navy-800"
            : "bg-navy-700 hover:bg-navy-600 hover:border-gold/30 cursor-pointer"
          }
        `}
      >
        <User size={13} className="text-gold/70 shrink-0" />
        <span className={selected ? "text-slate-200" : "text-slate-500"}>
          {selected ? selected.name : "Unassigned"}
        </span>
        <ChevronDown
          size={13}
          className={`text-slate-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop (both breakpoints) */}
          <div
            className="fixed inset-0 z-40 bg-black/60 sm:bg-transparent"
            onClick={() => setOpen(false)}
          />

          {/* Mobile: bottom sheet with a scrollable list — swipe stays in the list */}
          <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[75vh] flex-col rounded-t-3xl border-t border-white/10 bg-navy-800 shadow-2xl sm:hidden">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-white">Assign driver</p>
              <button
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-slate-400"
              >
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)] [touch-action:pan-y]">
              {options}
            </div>
          </div>

          {/* Desktop: popover, capped height so long lists scroll inside it */}
          <div className="absolute top-full left-0 z-50 mt-1 hidden max-h-72 w-56 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-navy-800 shadow-card slide-up sm:block [touch-action:pan-y]">
            {options}
          </div>
        </>
      )}
    </div>
  );
}
