"use client";

import { useState } from "react";
import DispatchCard from "./DispatchCard";
import { ACCENT_DOT_CLASSES } from "@/lib/operator/dispatchFilters";

/**
 * Single column of the Live Dispatch Centre kanban board. Snaps into view on
 * mobile (horizontal scroll) and becomes a fixed grid track on larger
 * screens. Drop handling is scaffolded but not wired up — see TODO below.
 */
export default function BoardColumn({ column, bookings, drivers, onViewDetails, onEdit, onAssignDriver }) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="flex w-[80vw] flex-shrink-0 snap-start flex-col gap-3 sm:w-[22rem] lg:w-auto">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 flex-shrink-0 rounded-full ${ACCENT_DOT_CLASSES[column.accent] ?? ACCENT_DOT_CLASSES.slate}`} />
          <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">{column.title}</h3>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
          {bookings.length}
        </span>
      </div>

      <div
        data-column={column.key}
        onDragOver={(e) => {
          // TODO(dispatch-dnd): once drag-and-drop is implemented, validate
          // the dragged booking's status transition (see validation.js)
          // before allowing a drop into this column.
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          // TODO(dispatch-dnd): read the booking id via
          // e.dataTransfer.getData("application/x-booking-id") and call
          // onUpdateStatus(id, column.statuses[0]) to move the card here.
        }}
        className={`flex max-h-[calc(100vh-22rem)] min-h-[6rem] flex-col gap-2.5 overflow-y-auto rounded-2xl border p-2.5 transition ${
          dragOver ? "border-amber-400/30 bg-amber-400/[0.04]" : "border-white/5 bg-white/[0.015]"
        }`}
      >
        {bookings.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-600">No transfers</p>
        ) : (
          bookings.map((b) => (
            <DispatchCard
              key={b.id}
              booking={b}
              drivers={drivers}
              onViewDetails={onViewDetails}
              onEdit={onEdit}
              onAssignDriver={onAssignDriver}
            />
          ))
        )}
      </div>
    </div>
  );
}
