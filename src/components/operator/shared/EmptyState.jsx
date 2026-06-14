"use client";

/**
 * Premium empty state with optional call-to-action.
 * Used wherever a list/queue/chart would otherwise render blank.
 */
export default function EmptyState({ icon: Icon, title, message, actionLabel, onAction, className = "" }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-6 py-10 text-center ${className}`}>
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {message && <p className="mt-1 max-w-xs text-xs text-slate-500">{message}</p>}
      </div>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
