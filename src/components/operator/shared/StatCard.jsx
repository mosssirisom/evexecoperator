"use client";

const ACCENT_CLASSES = {
  gold: "text-amber-300 bg-amber-400/10 border-amber-400/20",
  emerald: "text-emerald-300 bg-emerald-400/10 border-emerald-400/20",
  blue: "text-blue-300 bg-blue-400/10 border-blue-400/20",
  red: "text-red-300 bg-red-400/10 border-red-400/20",
  slate: "text-slate-300 bg-white/5 border-white/10",
};

/**
 * Compact stat tile used across the Command Centre and Analytics.
 * `onClick` is optional — when provided the tile becomes a button (e.g. to
 * jump straight to the relevant page/filter).
 */
export default function StatCard({ icon: Icon, label, value, sub, accent = "gold", onClick }) {
  const Comp = onClick ? "button" : "div";
  const accentClasses = ACCENT_CLASSES[accent] ?? ACCENT_CLASSES.gold;

  return (
    <Comp
      onClick={onClick}
      className={`card flex flex-col gap-3 rounded-2xl p-4 text-left transition sm:p-5 ${
        onClick ? "hover:border-amber-400/20 active:scale-[0.99]" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
        {Icon && (
          <span className={`flex h-8 w-8 items-center justify-center rounded-xl border ${accentClasses}`}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </Comp>
  );
}
