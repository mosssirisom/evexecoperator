"use client";

/**
 * Single entry in a booking activity log / timeline.
 * `icon` is a lucide component, `time` a pre-formatted string.
 */
export default function TimelineItem({ icon: Icon, title, detail, time, last = false }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-amber-300">
          {Icon && <Icon className="h-3.5 w-3.5" />}
        </span>
        {!last && <span className="mt-1 w-px flex-1 bg-white/10" />}
      </div>
      <div className="flex-1 pb-4">
        <p className="text-sm font-medium text-white">{title}</p>
        {detail && <p className="mt-0.5 text-xs text-slate-500">{detail}</p>}
        {time && <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-600">{time}</p>}
      </div>
    </div>
  );
}
