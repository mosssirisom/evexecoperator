"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

/**
 * Floating quick-action launcher. Sits above the mobile bottom nav and clear
 * of the iOS safe area. `actions`: Array<{ key, label, icon, onClick }>.
 */
export default function QuickActionMenu({ actions = [] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div
      ref={ref}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 flex flex-col items-end gap-2 sm:bottom-8 sm:right-8"
    >
      {open && (
        <div className="fade-in flex flex-col items-end gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => {
                  setOpen(false);
                  action.onClick?.();
                }}
                className="glass flex items-center gap-3 rounded-2xl pl-4 pr-2 py-2 text-sm font-medium text-white shadow-card transition hover:bg-white/10"
              >
                {action.label}
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                  {Icon && <Icon className="h-4 w-4" />}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
        className="bg-gold-gradient flex h-14 w-14 items-center justify-center rounded-full text-[#0B132B] shadow-gold-md transition active:scale-95"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </div>
  );
}
