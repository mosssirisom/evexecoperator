"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  MoreVertical, Eye, Pencil, UserPlus, MessageCircle, ChevronLeft, Check, Loader2,
} from "lucide-react";
import { whatsAppLink } from "@/lib/operator/contact";
import { driverDotClass } from "@/lib/operator/driverExtras";

const MENU_WIDTH = 224; // px — keep in sync with w-56 below

/**
 * "Quick actions" ("⋮") menu shared by the Board and Timeline dispatch
 * views: View Details, Edit Booking, Assign Driver (with inline driver
 * picker) and Message Customer (WhatsApp). Renders into a portal so it
 * escapes the scroll/overflow containers used by the kanban columns and
 * timeline rows.
 */
export default function QuickActionsMenu({ booking, drivers = [], onViewDetails, onEdit, onAssignDriver, className = "" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("menu"); // "menu" | "assign"
  const [assigning, setAssigning] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) {
        setOpen(false);
        setMode("menu");
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const toggle = (e) => {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 4,
        left: Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8),
      });
    }
    setMode("menu");
    setOpen((v) => !v);
  };

  const close = () => { setOpen(false); setMode("menu"); };
  const wa = whatsAppLink(booking.phone);

  const handleAssign = async (driverId) => {
    setAssigning(true);
    try {
      await onAssignDriver?.(booking.id, driverId);
    } finally {
      setAssigning(false);
      close();
    }
  };

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="Quick actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white/5 hover:text-amber-300"
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[200] w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#0B132B] py-1.5 shadow-2xl"
            style={{ top: pos.top, left: Math.max(pos.left, 8) }}
          >
            {mode === "menu" ? (
              <>
                <MenuButton icon={Eye} label="View Details" onClick={() => { close(); onViewDetails?.(booking); }} />
                <MenuButton icon={Pencil} label="Edit Booking" onClick={() => { close(); onEdit?.(booking); }} />
                <MenuButton
                  icon={UserPlus}
                  label="Assign Driver"
                  trailing={booking.driver}
                  onClick={() => setMode("assign")}
                />
                <MenuLink icon={MessageCircle} label="Message Customer" href={wa} onClick={close} />
              </>
            ) : (
              <DriverSubmenu
                booking={booking}
                drivers={drivers}
                assigning={assigning}
                onBack={() => setMode("menu")}
                onAssign={handleAssign}
              />
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

function MenuButton({ icon: Icon, label, onClick, trailing }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
      <span className="flex-1 truncate">{label}</span>
      {trailing && <span className="max-w-[5rem] flex-shrink-0 truncate text-[10px] text-slate-600">{trailing}</span>}
    </button>
  );
}

function MenuLink({ icon: Icon, label, href, onClick }) {
  if (!href) {
    return (
      <span className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-600">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="flex-1">{label}</span>
        <span className="text-[10px]">No number</span>
      </span>
    );
  }
  return (
    <a
      role="menuitem"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-xs text-slate-300 transition hover:bg-white/5 hover:text-white"
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
      <span className="flex-1">{label}</span>
    </a>
  );
}

function DriverSubmenu({ booking, drivers, assigning, onBack, onAssign }) {
  return (
    <>
      <button
        role="menuitem"
        onClick={onBack}
        className="flex w-full items-center gap-2 border-b border-white/5 px-4 py-2.5 text-left text-xs font-medium text-amber-300 transition hover:bg-white/5"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Assign Driver
      </button>
      <div className="max-h-60 overflow-y-auto">
        <button
          role="menuitem"
          onClick={() => onAssign(null)}
          disabled={assigning}
          className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs transition hover:bg-white/5 ${
            !booking.driverId ? "text-amber-300" : "text-slate-400"
          }`}
        >
          <span className="h-2 w-2 flex-shrink-0 rounded-full bg-slate-700" />
          <span className="flex-1">Unassigned</span>
          {!booking.driverId && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
        </button>
        {drivers.map((d) => (
          <button
            key={d.id}
            role="menuitem"
            onClick={() => onAssign(d.id)}
            disabled={assigning}
            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-xs transition hover:bg-white/5 ${
              d.id === booking.driverId ? "text-amber-300" : "text-slate-300"
            }`}
          >
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${driverDotClass(d.status)}`} />
            <span className="flex-1 truncate">{d.name}</span>
            {d.id === booking.driverId && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
          </button>
        ))}
        {assigning && (
          <div className="flex items-center justify-center gap-2 py-2.5 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Assigning…
          </div>
        )}
      </div>
    </>
  );
}
