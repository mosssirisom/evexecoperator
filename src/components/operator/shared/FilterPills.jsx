"use client";

/**
 * Horizontal row of selectable filter pills. `options` is an array of
 * strings or `{ value, label, count }` objects. Scrolls on mobile.
 */
export default function FilterPills({ options, value, onChange, className = "" }) {
  return (
    <div className={`flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}>
      {options.map((opt) => {
        const optValue = typeof opt === "string" ? opt : opt.value;
        const optLabel = typeof opt === "string" ? opt : opt.label;
        const count = typeof opt === "object" ? opt.count : undefined;
        const active = optValue === value;
        return (
          <button
            key={optValue}
            onClick={() => onChange(optValue)}
            className={`flex-shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              active
                ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                : "border-white/10 bg-white/[0.02] text-slate-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {optLabel}
            {count !== undefined && <span className="ml-1.5 text-[10px] opacity-70">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
