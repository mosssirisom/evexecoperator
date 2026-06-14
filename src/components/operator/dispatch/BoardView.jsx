"use client";

import BoardColumn from "./BoardColumn";
import { BOARD_COLUMNS } from "@/lib/operator/dispatchFilters";

function ColumnSkeleton() {
  return (
    <div className="flex w-[80vw] flex-shrink-0 snap-start flex-col gap-3 sm:w-[22rem] lg:w-auto">
      <div className="h-4 w-24 animate-pulse rounded-full bg-white/[0.04]" />
      <div className="flex flex-col gap-2.5 rounded-2xl border border-white/5 bg-white/[0.015] p-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl border border-white/5 bg-white/[0.02]" />
        ))}
      </div>
    </div>
  );
}

/**
 * Board (kanban) view of the Live Dispatch Centre. Six columns mirror the
 * booking status machine: Unassigned → Assigned → Driver En Route →
 * Passenger On Board → Completed / Cancelled.
 */
export default function BoardView({ bookings, drivers, loading, onViewDetails, onEdit, onAssignDriver }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-6 lg:gap-3 lg:overflow-visible">
      {loading && bookings.length === 0
        ? BOARD_COLUMNS.map((col) => <ColumnSkeleton key={col.key} />)
        : BOARD_COLUMNS.map((col) => (
            <BoardColumn
              key={col.key}
              column={col}
              bookings={bookings.filter((b) => col.statuses.includes(b.status))}
              drivers={drivers}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onAssignDriver={onAssignDriver}
            />
          ))}
    </div>
  );
}
