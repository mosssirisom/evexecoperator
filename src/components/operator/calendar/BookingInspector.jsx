"use client";

import { ArrowUpRight, CornerDownRight, Phone, Plane, X } from "lucide-react";
import { fmtDate } from "@/lib/dates";
import { longDay } from "@/lib/operator/calendarModel";
import { FlagLine, StateLabel } from "./BookingRow";

function Field({ label, children, className = "" }) {
  if (children == null || children === "" || children === false) return null;
  return (
    <div className={className}>
      <dt className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cal-muted">{label}</dt>
      <dd className="mt-1 text-[13.5px] leading-snug text-cal-ink">{children}</dd>
    </div>
  );
}

const money = (n) => `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The side panel's booking view (desktop). Read-only summary; every change
 * goes through the shared booking drawer, which already handles status,
 * driver, payment, notes, edits and the return leg.
 */
export default function BookingInspector({ b, drivers = [], unavailable = new Set(), onAssign, onClose, onOpenFull, onGoToDate }) {
  const canAssign = onAssign && !["done", "cancelled", "reply"].includes(b.state);
  const flight = b.flight && b.flight !== "—" ? b.flight : null;
  const pickup = b.pickupLocation || b.airport || b.direction;
  const dropoff = b.dropoffAddress || b.airport;
  const passengers = b.passengers ? `${b.passengers} passenger${b.passengers === 1 ? "" : "s"}` : null;
  const vehicle = [b.vehicleType, passengers, b.luggage ? `${b.luggage} luggage` : null].filter(Boolean).join(" · ");

  return (
    <article aria-label={`Booking ${b.id}`}>
      <header className="flex items-start justify-between gap-3 border-b border-cal-line pb-3">
        <div className="min-w-0">
          <StateLabel state={b.state} />
          <p className="mt-2 font-display text-[30px] font-medium leading-none tabular-nums text-cal-ink">{b.minutes == null ? "--:--" : b.time}</p>
          <p className="mt-1.5 text-[12.5px] text-cal-muted">{b.travelDate ? longDay(b.travelDate) : "No date"} · <span className="tabular-nums">{b.id}</span></p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close booking" className="flex h-8 w-8 items-center justify-center rounded-md text-cal-muted hover:bg-cal-well hover:text-cal-ink">
          <X className="h-4 w-4" />
        </button>
      </header>

      {b.flags.length > 0 && (
        <div className="border-b border-cal-line py-2.5">
          <FlagLine flags={b.flags} max={6} />
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 py-4">
        <Field label="Client" className="col-span-2">
          <span className="font-semibold">{b.customer}</span>
          {(b.phone || b.email) && (
            <span className="mt-0.5 block text-[12.5px] text-cal-ink2">
              {b.phone && <a href={`tel:${b.phone.replace(/\s/g, "")}`} className="tabular-nums hover:underline">{b.phone}</a>}
              {b.phone && b.email && " · "}
              {b.email && <span className="break-all">{b.email}</span>}
            </span>
          )}
        </Field>
        <Field label="Pick-up" className="col-span-2">{pickup}</Field>
        <Field label="Drop-off" className="col-span-2">{dropoff}</Field>
        <Field label="Flight">{flight && <span className="inline-flex items-center gap-1.5 tabular-nums"><Plane className="h-3.5 w-3.5 text-cal-muted" />{flight}</span>}</Field>
        <Field label="Journey">{b.journeyType}</Field>
        <Field label="Vehicle & party" className="col-span-2">{vehicle}</Field>
        {canAssign ? (
          <div className="col-span-2">
            <label htmlFor="cal-assign" className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-cal-muted">Driver</label>
            <select
              id="cal-assign"
              value={b.driverId ?? ""}
              onChange={(e) => onAssign(b.id, e.target.value || null)}
              className={`mt-1 h-9 w-full rounded-md border bg-cal-sheet px-2 text-[13.5px] outline-none focus:border-cal-brass ${b.driverId ? "border-cal-rule text-cal-ink" : "border-cal-alert/50 text-cal-alert"}`}
            >
              <option value="">Not assigned</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.kind === "partner" ? " (partner)" : ""}{unavailable.has(d.id) ? " — unavailable this day" : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Field label="Driver">
            {b.driverId ? b.driver : <span className="font-medium text-cal-alert">Not assigned</span>}
          </Field>
        )}
        <Field label="Fare">
          {b.fare == null ? <span className="text-cal-muted">TBC</span> : <span className="tabular-nums">{money(b.fare)}</span>}
        </Field>
        <Field label="Payment">{[b.paymentStatus, b.paymentMethod].filter(Boolean).join(" · ")}</Field>
        <Field label="Booked via">{b.source === "website" ? "Website" : b.source ? b.source[0].toUpperCase() + b.source.slice(1) : null}</Field>
        {b.notes && <Field label="Notes" className="col-span-2"><span className="whitespace-pre-line text-cal-ink2">{b.notes}</span></Field>}
        {b.returnJourney && b.returnDate && (
          <Field label="Return" className="col-span-2">
            <button type="button" onClick={() => onGoToDate(b.returnDate)} className="inline-flex items-center gap-1.5 font-medium text-cal-ink hover:text-cal-brass-ink">
              <CornerDownRight className="h-3.5 w-3.5" />
              {fmtDate(b.returnDate)}{b.returnTime ? ` ${b.returnTime.slice(0, 5)}` : ""} — show on calendar
            </button>
          </Field>
        )}
      </dl>

      <div className="sticky -bottom-5 -mx-5 -mb-5 border-t border-cal-line bg-cal-sheet px-5 pb-5 pt-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onOpenFull(b)}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-cal-ink px-4 text-[13.5px] font-semibold text-cal-sheet hover:bg-cal-ink2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cal-brass focus-visible:ring-offset-2"
        >
          {b.state === "reply" ? "Accept or decline" : "Open booking"}
          <ArrowUpRight className="h-4 w-4" />
        </button>
        {b.phone && (
          <a
            href={`tel:${b.phone.replace(/\s/g, "")}`}
            aria-label={`Call ${b.customer}`}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-cal-rule text-cal-ink hover:bg-cal-well"
          >
            <Phone className="h-4 w-4" />
          </a>
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-cal-muted">Status, payment, notes and edits are in the booking.</p>
      </div>
    </article>
  );
}
