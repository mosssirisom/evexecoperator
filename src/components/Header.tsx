"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Plus, ExternalLink, Menu, X, LogOut, Bell, CalendarPlus } from "lucide-react";

interface AlertItem {
  id: string;
  ref: string;
  customer: string;
  route: string;
  time: string | null;
  date: string | null;
  source: string;
  createdAt: string;
}

interface Props {
  onNewBooking: () => void;
  onSignOut: () => void;
  newBookings?: AlertItem[];
  onOpenBooking?: (b: AlertItem) => void;
  onClearAlerts?: () => void;
}

// Header notification bell — surfaces jobs coming in from the website.
function NotificationBell({ items, onOpen, onClear }: { items: AlertItem[]; onOpen?: (b: AlertItem) => void; onClear?: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: PointerEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);
  const count = items.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={count > 0 ? `Notifications — ${count} new` : "Notifications"}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:bg-slate-100 hover:text-amber-600"
      >
        <Bell size={17} />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-600">New jobs</p>
            {count > 0 && (
              <button onClick={() => { onClear?.(); setOpen(false); }} className="text-[10px] text-slate-500 transition hover:text-amber-600">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {count === 0 ? (
              <p className="py-6 text-center text-sm text-slate-600">No new jobs right now</p>
            ) : (
              items.map((b) => (
                <button
                  key={b.id}
                  onClick={() => { onOpen?.(b); setOpen(false); }}
                  className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 transition hover:bg-slate-100"
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
                    <CalendarPlus size={14} className="text-emerald-600" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">{b.customer}</span>
                    <span className="block truncate text-xs text-slate-500">{b.route}</span>
                    <span className="mt-0.5 block text-[10px] text-slate-600">
                      {b.source === "website" ? "Website booking" : "New booking"}
                      {b.time ? ` · ${b.time}` : ""}{b.date ? ` · ${b.date}` : ""} · {b.ref}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const ECOSYSTEM_LINKS = [
  { label: "Operator Portal", href: "/operator/dispatch",                 abbr: "Operator",     internal: true  },
];

export default function Header({ onNewBooking, onSignOut, newBookings = [], onOpenBooking, onClearAlerts }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="relative w-full"
      style={{
        background: "linear-gradient(to right, #0c0f18 0%, #14182a 40%, #1c2035 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] flex items-center justify-between gap-4">

        {/* ── Logo + wordmark ── */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Text */}
          <div className="min-w-0">
            <h1
              className="text-[#0F1B33] leading-none font-black tracking-tight truncate"
              style={{ fontSize: "clamp(1.6rem, 5vw, 2.4rem)", letterSpacing: "-0.01em" }}
            >
              EV EXEC
            </h1>
            <p
              className="text-slate-500 font-medium uppercase mt-1 tracking-widest truncate"
              style={{ fontSize: "clamp(0.55rem, 1.5vw, 0.7rem)", letterSpacing: "0.22em" }}
            >
              Premium Airport Transfers
            </p>
          </div>
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Ecosystem links — desktop */}
          <div className="hidden md:flex items-center gap-1">
            {ECOSYSTEM_LINKS.map((link) =>
              link.internal ? (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors"
                >
                  {link.abbr}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors"
                >
                  {link.abbr}
                  <ExternalLink size={9} />
                </a>
              )
            )}
          </div>

          {/* Notification bell — jobs coming in from the website */}
          <NotificationBell items={newBookings} onOpen={onOpenBooking} onClear={onClearAlerts} />

          {/* + New booking */}
          <button
            onClick={onNewBooking}
            className="
              flex items-center justify-center w-9 h-9 rounded-full
              bg-gold-gradient text-navy-900 font-bold
              shadow-gold-sm hover:shadow-gold-md active:scale-95 transition-all
            "
            aria-label="New booking"
          >
            <Plus size={18} strokeWidth={3} />
          </button>

          {/* Sign out — desktop */}
          <button
            onClick={onSignOut}
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-600 hover:bg-slate-100 transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={12} />
            Sign out
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-700"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-full right-4 z-50 w-48 rounded-xl border border-slate-200 bg-white shadow-card overflow-hidden slide-up md:hidden">
          {ECOSYSTEM_LINKS.map((link) =>
            link.internal ? (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 hover:text-amber-600 transition-colors"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 hover:text-amber-600 transition-colors"
              >
                {link.label}
                <ExternalLink size={12} />
              </a>
            )
          )}
          <button
            onClick={() => {
              setMenuOpen(false);
              onSignOut();
            }}
            className="flex items-center justify-between w-full px-4 py-3 text-sm text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors border-t border-slate-100"
          >
            Sign out
            <LogOut size={12} />
          </button>
        </div>
      )}
    </header>
  );
}

// ─── Circular EV Exec badge — SVG matching the evexec.co.uk logo style ─────────────────────────────
function EvExecBadge() {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Outer gold ring */}
      <circle cx="50" cy="50" r="49" fill="#0b0f1e" />
      <circle cx="50" cy="50" r="49" fill="none" stroke="#C9A550" strokeWidth="1.8" />

      {/* Inner dark circle */}
      <circle cx="50" cy="50" r="46" fill="#0d1226" />

      {/* Globe wireframe lines */}
      <circle cx="50" cy="50" r="34" fill="none" stroke="#1a2d5a" strokeWidth="0.8" />
      {/* Vertical meridian */}
      <line x1="50" y1="16" x2="50" y2="84" stroke="#1a2d5a" strokeWidth="0.7" />
      {/* Horizontal equator */}
      <line x1="16" y1="50" x2="84" y2="50" stroke="#1a2d5a" strokeWidth="0.7" />
      {/* Diagonal latitude arcs */}
      <ellipse cx="50" cy="50" rx="20" ry="34" fill="none" stroke="#1a2d5a" strokeWidth="0.6" />
      <ellipse cx="50" cy="50" rx="28" ry="34" fill="none" stroke="#1a2d5a" strokeWidth="0.6" />
      {/* Upper/lower latitude rings */}
      <ellipse cx="50" cy="38" rx="23" ry="6" fill="none" stroke="#1a2d5a" strokeWidth="0.6" />
      <ellipse cx="50" cy="62" rx="23" ry="6" fill="none" stroke="#1a2d5a" strokeWidth="0.6" />

      {/* Car body — sleek EV silhouette */}
      {/* Main body */}
      <rect x="20" y="48" width="60" height="14" rx="3" fill="#141830" />
      {/* Cabin/roof */}
      <path d="M32 48 L38 37 L62 37 L68 48 Z" fill="#141830" />
      {/* Windshield */}
      <path d="M39 48 L43 39 L57 39 L61 48 Z" fill="#1e3060" opacity="0.7" />
      {/* Side window highlight */}
      <path d="M39 48 L43 39 L47 39 L44 48 Z" fill="#264070" opacity="0.5" />
      {/* Rear spoiler */}
      <rect x="63" y="44" width="5" height="4" rx="1" fill="#141830" />
      {/* Front bumper glow */}
      <rect x="78" y="50" width="4" height="6" rx="1" fill="#C9A550" opacity="0.6" />
      {/* Rear lights */}
      <rect x="18" y="51" width="4" height="5" rx="1" fill="#C9A550" opacity="0.5" />
      {/* Wheels */}
      <circle cx="33" cy="62" r="7.5" fill="#090e1c" />
      <circle cx="33" cy="62" r="5"   fill="#1a1f35" />
      <circle cx="33" cy="62" r="2.5" fill="#0d1226" />
      <circle cx="67" cy="62" r="7.5" fill="#090e1c" />
      <circle cx="67" cy="62" r="5"   fill="#1a1f35" />
      <circle cx="67" cy="62" r="2.5" fill="#0d1226" />
      {/* Wheel arches */}
      <path d="M25 62 Q25 55 33 55 Q41 55 41 62" fill="#141830" />
      <path d="M59 62 Q59 55 67 55 Q75 55 75 62" fill="#141830" />
      {/* Ground shadow */}
      <ellipse cx="50" cy="71" rx="28" ry="3" fill="#000" opacity="0.35" />

      {/* Lightning bolt — gold, positioned centre-right of cabin */}
      <path
        d="M56 31 L50 44 L55 44 L49 57 L60 41 L55 41 L61 31 Z"
        fill="#C9A550"
      />

      {/* EV EXEC label at bottom of circle */}
      <text
        x="50"
        y="84"
        textAnchor="middle"
        fill="#C9A550"
        fontSize="7.5"
        fontWeight="800"
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="1.5"
      >
        EV EXEC
      </text>
    </svg>
  );
}
