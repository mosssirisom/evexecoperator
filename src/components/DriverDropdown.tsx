"use client";

import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
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
          {selected ? selected.full_name : "Unassigned"}
        </span>
        <ChevronDown
          size={13}
          className={`text-slate-500 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-1 left-0 z-20 w-56 rounded-xl border border-white/10 bg-navy-800 shadow-card overflow-hidden slide-up">
            {/* Unassign option */}
            <button
              onClick={() => { onAssign(null); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 text-sm text-slate-400 hover:bg-navy-700 hover:text-slate-200 transition-colors"
            >
              Unassigned
            </button>
            <div className="h-px bg-white/5 mx-3" />

            {drivers.map((driver) => {
              const unavailable = unavailableDriverIds?.has(driver.id) ?? false;
              return (
                <button
                  key={driver.id}
                  onClick={() => { onAssign(driver.id); setOpen(false); }}
                  className={`
                    w-full text-left px-4 py-2.5 transition-colors
                    ${driver.id === selectedDriverId
                      ? "bg-gold/10 text-gold"
                      : "text-slate-200 hover:bg-navy-700"
                    }
                  `}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm">{driver.full_name}</span>
                    {unavailable && (
                      <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded-full">
                        Off this day
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {driver.vehicle_model ?? "—"}{driver.vehicle_registration ? ` · ${driver.vehicle_registration}` : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
