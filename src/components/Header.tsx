"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, ExternalLink, Menu, X, LogOut } from "lucide-react";

interface Props {
  onNewBooking: () => void;
  onSignOut: () => void;
}

const ECOSYSTEM_LINKS = [
  { label: "Operator Portal", href: "/operator/dispatch",                 abbr: "Operator",     internal: true  },
];

export default function Header({ onNewBooking, onSignOut }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="relative w-full"
      style={{
        background: "linear-gradient(to right, #0c0f18 0%, #14182a 40%, #1c2035 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">

        {/* ── Logo + wordmark ── */}
        <div className="flex items-center gap-4 min-w-0">
          {/* Text */}
          <div className="min-w-0">
            <h1
              className="text-white leading-none font-black tracking-tight truncate"
              style={{ fontSize: "clamp(1.6rem, 5vw, 2.4rem)", letterSpacing: "-0.01em" }}
            >
              EV EXEC
            </h1>
            <p
              className="text-slate-400 font-medium uppercase mt-1 tracking-widest truncate"
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
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-gold hover:bg-white/5 transition-colors"
                >
                  {link.abbr}
                </Link>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-gold hover:bg-white/5 transition-colors"
                >
                  {link.abbr}
                  <ExternalLink size={9} />
                </a>
              )
            )}
          </div>

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
            className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
            aria-label="Sign out"
          >
            <LogOut size={12} />
            Sign out
          </button>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden p-2 text-slate-400 hover:text-slate-200"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="absolute top-full right-4 z-50 w-48 rounded-xl border border-white/10 bg-navy-800 shadow-card overflow-hidden slide-up md:hidden">
          {ECOSYSTEM_LINKS.map((link) =>
            link.internal ? (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:bg-navy-700 hover:text-gold transition-colors"
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
                className="flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:bg-navy-700 hover:text-gold transition-colors"
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
            className="flex items-center justify-between w-full px-4 py-3 text-sm text-slate-300 hover:bg-navy-700 hover:text-red-400 transition-colors border-t border-white/5"
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
