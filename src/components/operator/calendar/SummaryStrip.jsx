"use client";

// The period's numbers as one ruled strip under the toolbar. Each count is a
// filter: tap "Needs driver" and every view shows only those jobs. Revenue is
// information only. When the loaded data doesn't cover the whole period the
// numbers are withheld (—) rather than shown wrong.

const money = (n) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export default function SummaryStrip({ metrics, status, onStatus, complete }) {
  const cells = [
    { key: "all", label: "Transfers", value: metrics.total },
    { key: "confirmed", label: "Confirmed", value: metrics.confirmed },
    { key: "reply", label: "Awaiting reply", value: metrics.reply, tone: metrics.reply ? "text-cal-brass-ink" : null },
    { key: "driver", label: "Need driver", value: metrics.driver, tone: metrics.driver ? "text-cal-alert" : null },
    { key: "attention", label: "Attention", value: metrics.attention, tone: metrics.attention ? "text-cal-alert" : null },
  ];

  return (
    <div className="border-b border-cal-line">
      <div role="group" aria-label="Period summary" className="grid grid-cols-3 gap-y-1 sm:flex">
        {cells.map((c) => {
          const active = status === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onStatus(active && c.key !== "all" ? "all" : c.key)}
              aria-pressed={active}
              className="group relative flex min-w-0 flex-col items-start py-2.5 pr-3 text-left focus-visible:outline-none sm:flex-1 sm:py-3 sm:pr-5"
            >
              <span className={`order-1 text-[19px] font-semibold leading-none tabular-nums sm:text-[20px] ${complete ? c.tone ?? "text-cal-ink" : "text-cal-faint"}`}>
                {complete ? c.value : "—"}
              </span>
              <span className={`order-2 mt-1.5 truncate text-[11px] font-medium ${active ? "text-cal-ink" : "text-cal-muted group-hover:text-cal-ink"}`}>{c.label}</span>
              <span aria-hidden className={`absolute bottom-[-1px] left-0 right-3 h-[2px] sm:right-5 ${active ? "bg-cal-brass" : "bg-transparent group-focus-visible:bg-cal-rule"}`} />
            </button>
          );
        })}
        <div className="order-first col-start-3 row-start-1 flex min-w-0 flex-col items-start py-2.5 sm:order-none sm:ml-auto sm:flex-none sm:border-l sm:border-cal-line sm:py-3 sm:pl-4">
          <span className={`text-[20px] font-semibold leading-none tabular-nums ${complete ? "text-cal-ink" : "text-cal-faint"}`}>
            {complete ? money(metrics.revenue) : "—"}
          </span>
          <span className="mt-1.5 whitespace-nowrap text-[11px] font-medium text-cal-muted">
            Revenue{complete && metrics.unpriced ? ` · ${metrics.unpriced} TBC` : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
