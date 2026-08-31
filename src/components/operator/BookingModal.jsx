"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Plane, MapPin, Clock, User, Car, PoundSterling, ChevronDown, ArrowLeftRight, Search } from "lucide-react";
import { useDrivers } from "@/hooks/operator/useDrivers";

// Builds a de-duplicated list of past customers from the bookings feed, so a
// manual booking can reuse a saved customer's details instead of retyping them.
// Keyed by phone (falling back to name); later records backfill a missing email.
export function customersFromBookings(bookings = []) {
  const clean = (v) => (v && v !== "—" ? String(v).trim() : "");
  const map = new Map();
  for (const b of bookings) {
    const name = clean(b.customer);
    const phone = clean(b.phone);
    const email = clean(b.email);
    if (!name && !phone) continue;
    const key = phone || name.toLowerCase();
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { name, phone, email });
    } else {
      if (!existing.email && email) existing.email = email;
      if (!existing.phone && phone) existing.phone = phone;
    }
  }
  return [...map.values()].filter((c) => c.name).sort((a, b) => a.name.localeCompare(b.name));
}

// Type-ahead picker for reusing an existing customer's details.
function CustomerPicker({ customers, onPick }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = t
      ? customers.filter((c) =>
          c.name.toLowerCase().includes(t) ||
          c.phone.toLowerCase().includes(t) ||
          c.email.toLowerCase().includes(t))
      : customers;
    return list.slice(0, 8);
  }, [q, customers]);

  if (!customers.length) return null;

  return (
    <div ref={ref} className="relative mb-4">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Use an existing customer — search name, phone or email"
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-[#0F1B33] outline-none placeholder:text-slate-400 focus:border-amber-400/40 transition"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
          {results.map((c, i) => (
            <button
              type="button"
              key={`${c.phone || c.name}-${i}`}
              onClick={() => { onPick(c); setOpen(false); setQ(""); }}
              className="flex w-full flex-col items-start px-4 py-2.5 text-left transition hover:bg-slate-100"
            >
              <span className="text-sm font-medium text-[#0F1B33]">{c.name}</span>
              {(c.phone || c.email) && (
                <span className="text-xs text-slate-500">{[c.phone, c.email].filter(Boolean).join("  ·  ")}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const AIRPORTS = [
  "Manchester Airport (MAN)",
  "Liverpool Airport (LPL)",
  "Leeds Bradford Airport (LBA)",
  "Birmingham Airport (BHX)",
  "Blackpool Airport (BLK)",
  "London Heathrow (LHR)",
  "London Gatwick (LGW)",
  "East Midlands Airport (EMA)",
  "Newcastle Airport (NCL)",
  "Glasgow Airport (GLA)",
  "Edinburgh Airport (EDI)",
];

const DESTINATIONS = [
  "Blackpool",
  "Lytham St Annes",
  "Poulton-le-Fylde",
  "Preston",
  "Southport",
  "Chorley",
];

function getSuggestedPrice(airport) {
  try {
    const saved = JSON.parse(localStorage.getItem("evexec_settings") || "{}");
    const fleet = saved.fleet || {};
    const parse = (s) => { const n = parseInt(String(s || "").replace(/[^0-9]/g, ""), 10); return n > 0 ? n : null; };
    if (airport.includes("MAN")) return parse(fleet.rateMan);
    if (airport.includes("LPL")) return parse(fleet.rateLpl);
  } catch {}
  return null;
}


function Field({ label, icon: Icon, error, children }) {
  return (
    <div>
      <label className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0F1B33] outline-none focus:border-amber-400/40 transition"
      >
        <option value="" className="bg-white">{placeholder}</option>
        {options.map((o) => (
          <option key={typeof o === "string" ? o : o.id} value={typeof o === "string" ? o : o.id} className="bg-white">
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0F1B33] outline-none placeholder:text-slate-400 focus:border-amber-400/40 transition"
    />
  );
}

const DIRECTION_OPTIONS = ["Airport → Destination", "Destination → Airport"];

const empty = {
  customer: "",
  phone: "",
  email: "",
  direction: "Airport → Destination",
  airport: "",
  destination: "",
  bespoke: false,
  customAddress: "",
  flight: "",
  date: "",
  time: "",
  returnJourney: false,
  returnDate: "",
  returnTime: "",
  returnFlight: "",
  driver: "",
  price: "",
  notes: "",
};

export default function BookingModal({ open, onClose, onSubmit, initialValues, customers = [] }) {
  const { drivers } = useDrivers();
  const vehicles = useMemo(
    () => drivers.map((d) => ({ id: d.id, label: `${d.name} — ${d.vehicle}` })),
    [drivers]
  );
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const closeTimerRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) {
      clearTimeout(closeTimerRef.current);
      setForm(empty);
      setErrors({});
      setSubmitted(false);
      setSubmitting(false);
      setSubmitError(null);
    } else {
      // Pre-fill with initial values when provided (e.g. return journey). If the
      // prefilled destination isn't one of the listed towns, treat it as bespoke.
      const iv = initialValues ? { ...empty, ...initialValues } : { ...empty };
      if (iv.destination && iv.destination !== "Custom address…" && !DESTINATIONS.includes(iv.destination)) {
        iv.bespoke = true;
        iv.customAddress = iv.customAddress || iv.destination;
        iv.destination = "";
      } else if (iv.destination === "Custom address…") {
        iv.bespoke = true;
        iv.destination = "";
      }
      setForm(iv);
      // Focus first focusable element when modal opens
      setTimeout(() => {
        const first = dialogRef.current?.querySelector(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        first?.focus();
      }, 0);
    }
  }, [open]);

  useEffect(() => {
    return () => clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    const handleKey = (e) => {
      if (!open) return;
      if (e.key === "Escape" && !submitting) { onClose(); return; }
      // Focus trap: cycle Tab within the dialog
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose, submitting]);

  const set = useCallback(
    (field) => (value) => setForm((f) => ({ ...f, [field]: value })),
    []
  );

  useEffect(() => {
    if (!form.airport || form.bespoke || !form.destination) return;
    if (form.price) return; // don't override a pre-filled price
    const suggested = getSuggestedPrice(form.airport);
    if (suggested !== null) setForm((f) => ({ ...f, price: String(suggested) }));
  }, [form.airport, form.destination, form.bespoke]);

  function validate() {
    const e = {};
    if (!form.customer.trim()) e.customer = "Customer name is required";
    if (!form.phone.trim()) e.phone = "Phone number is required";
    if (!form.airport) e.airport = "Airport is required";
    if (form.bespoke) {
      if (!form.customAddress.trim()) e.customAddress = "Please enter the address";
    } else if (!form.destination) {
      e.destination = "Destination is required";
    }
    if (!form.date) e.date = "Date is required";
    if (!form.time) e.time = "Pickup time is required";
    if (form.returnJourney) {
      if (!form.returnDate) e.returnDate = "Return date is required";
      if (!form.returnTime) e.returnTime = "Return time is required";
    }
    return e;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const e2 = validate();
    if (Object.keys(e2).length) {
      setErrors(e2);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const numPrice = form.price ? Number(form.price) || null : null;
      await onSubmit?.({ ...form, price: numPrice });
      setSubmitted(true);
      closeTimerRef.current = setTimeout(onClose, 1200);
    } catch (err) {
      setSubmitError(err?.message ?? "Failed to create booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal — full-screen bottom sheet on mobile, centered dialog on desktop */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-modal-title"
        className="relative z-10 flex max-h-[96vh] w-full flex-col overflow-hidden rounded-t-[28px] border border-slate-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-3xl"
      >
        {/* Mobile drag handle */}
        <div className="flex flex-shrink-0 justify-center pb-1 pt-3 sm:hidden">
          <div className="h-1 w-12 rounded-full bg-slate-200" />
        </div>
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 bg-white px-4 py-4 sm:px-8 sm:py-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-600">
              {initialValues ? "Return Journey" : "New Booking"}
            </p>
            <h2 id="booking-modal-title" className="mt-1 text-2xl font-semibold text-[#0F1B33]">
              {initialValues ? "Create Return" : "Create Transfer"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-[#0F1B33]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/10">
              <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-[#0F1B33]">Booking Created</p>
            <p className="text-sm text-slate-500">Transfer added to dispatch board</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-5 px-4 py-4 sm:gap-6 sm:px-8 sm:py-6">
            {/* Customer */}
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-600">
                Customer Details
              </p>
              <CustomerPicker
                customers={customers}
                onPick={(c) => setForm((f) => ({ ...f, customer: c.name, phone: c.phone || "", email: c.email || "" }))}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Full Name" icon={User} error={errors.customer}>
                  <Input value={form.customer} onChange={set("customer")} placeholder="James Whitmore" />
                </Field>
                <Field label="Phone" error={errors.phone}>
                  <Input value={form.phone} onChange={set("phone")} placeholder="+44 7700 900000" />
                </Field>
                <Field label="Email (optional)">
                  <Input value={form.email} onChange={set("email")} placeholder="passenger@example.com" type="email" />
                </Field>
                <Field label="Flight Number">
                  <Input value={form.flight} onChange={set("flight")} placeholder="EK017" />
                </Field>
              </div>
            </div>

            {/* Route */}
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-600">
                Route
              </p>
              <div className="grid gap-4">
                <Field label="Direction">
                  <Select value={form.direction} onChange={set("direction")} options={DIRECTION_OPTIONS} placeholder="" />
                </Field>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Airport" icon={Plane} error={errors.airport}>
                    <Select value={form.airport} onChange={set("airport")} options={AIRPORTS} placeholder="Select airport" />
                  </Field>
                  {form.bespoke ? (
                    <Field label="Bespoke Address" icon={MapPin} error={errors.customAddress}>
                      <Input value={form.customAddress} onChange={set("customAddress")} placeholder="Enter full address" />
                    </Field>
                  ) : (
                    <Field label="Destination" icon={MapPin} error={errors.destination}>
                      <Select value={form.destination} onChange={set("destination")} options={DESTINATIONS} placeholder="Select destination" />
                    </Field>
                  )}
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.bespoke}
                    onChange={(e) => set("bespoke")(e.target.checked)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  Bespoke / custom address (not a listed destination)
                </label>
              </div>
            </div>

            {/* Schedule */}
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-600">
                Schedule
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Date" error={errors.date}>
                  <Input value={form.date} onChange={set("date")} type="date" />
                </Field>
                <Field label="Pickup Time" icon={Clock} error={errors.time}>
                  <Input value={form.time} onChange={set("time")} type="time" />
                </Field>
              </div>
            </div>

            {/* Return journey */}
            <div>
              <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="flex items-center gap-2 text-sm font-medium text-[#0F1B33]">
                  <ArrowLeftRight className="h-4 w-4 text-amber-600" />
                  Add return journey
                </span>
                <input
                  type="checkbox"
                  checked={form.returnJourney}
                  onChange={(e) => set("returnJourney")(e.target.checked)}
                  className="h-5 w-5 accent-amber-500"
                />
              </label>

              {form.returnJourney && (
                <div className="mt-4 grid gap-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Return Date" error={errors.returnDate}>
                      <Input value={form.returnDate} onChange={set("returnDate")} type="date" />
                    </Field>
                    <Field label="Return Pickup Time" icon={Clock} error={errors.returnTime}>
                      <Input value={form.returnTime} onChange={set("returnTime")} type="time" />
                    </Field>
                  </div>
                  <Field label="Return Flight Number (optional)" icon={Plane}>
                    <Input value={form.returnFlight} onChange={set("returnFlight")} placeholder="EK018" />
                  </Field>
                  {form.airport && (form.destination || form.customAddress) && (
                    <p className="text-xs text-slate-500">
                      Return runs {form.destination === "Custom address…" ? form.customAddress || "your address" : form.destination} → {form.airport}, booked as its own job on the board.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Driver + Price */}
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Assign Driver" icon={Car}>
                <Select value={form.driver} onChange={set("driver")} options={vehicles} placeholder="Auto-assign" />
              </Field>
              <Field label="Fixed Price" icon={PoundSterling}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">£</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.price}
                    onChange={(e) => set("price")(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-8 pr-4 text-sm text-amber-600 outline-none placeholder:text-slate-400 focus:border-amber-400/40 transition"
                  />
                </div>
              </Field>
            </div>

            {/* Notes */}
            <Field label="Notes (optional)">
              <textarea
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Child seat required, meet & greet at arrivals..."
                rows={3}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-[#0F1B33] outline-none placeholder:text-slate-400 focus:border-amber-400/40 transition"
              />
            </Field>

            {/* Submit */}
            {submitError && (
              <p className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-600">
                {submitError}
              </p>
            )}
            <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm text-slate-500 transition hover:border-slate-300 hover:text-[#0F1B33]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? "Creating…" : `Create Booking${form.price ? ` — £${form.price}` : ""}`}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}