"use client";

import { useState } from "react";
import { X, Plane, MapPin, Users, Calendar, Briefcase, type LucideIcon } from "lucide-react";
import { format } from "date-fns";
import type { DbBooking, DbDriver } from "@/lib/database.types";

type NewBooking = Omit<DbBooking, "id" | "ref" | "created_at" | "updated_at" | "drivers">;

export interface BookingPrefill {
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
  travel_date?: string;
  travel_time?: string;
  airport?: string;
  dropoff_address?: string;
  direction?: string;
  flight_number?: string;
  passengers?: number;
  luggage?: string;
  notes?: string;
}

interface Props {
  drivers: DbDriver[];
  defaultDate?: Date;
  prefill?: BookingPrefill;
  onSave: (data: NewBooking) => Promise<void>;
  onClose: () => void;
}

const DIRECTIONS = [
  "Airport → Destination",
  "Destination → Airport",
  "Point to Point",
];

const BAG_OPTIONS = ["None", "1 piece", "2 pieces", "3 pieces", "4 pieces", "5+ pieces", "Golf clubs", "Bike box", "Custom"];

export default function AddBookingModal({ drivers, defaultDate, prefill, onSave, onClose }: Props) {
  const today = defaultDate ?? new Date();
  const dateStr = format(today, "yyyy-MM-dd");

  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    travel_date: prefill?.travel_date ?? dateStr,
    travel_time: prefill?.travel_time ?? "09:00",
    customer_name: prefill?.customer_name ?? "",
    customer_phone: prefill?.customer_phone ?? "",
    customer_email: prefill?.customer_email ?? "",
    airport: prefill?.airport ?? "",
    dropoff_address: prefill?.dropoff_address ?? "",
    direction: prefill?.direction ?? DIRECTIONS[0],
    flight_number: prefill?.flight_number ?? "",
    passengers: prefill?.passengers ? String(prefill.passengers) : "1",
    luggage: prefill?.luggage ?? "",
    luggagePreset: prefill?.luggage && !BAG_OPTIONS.includes(prefill.luggage) ? "Custom" : prefill?.luggage ?? "",
    driver_id: "",
    quoted_price: "",
    notes: prefill?.notes ?? "",
    priority: false,
  });

  const set = (key: string, val: string | boolean) =>
    setForm((f) => ({ ...f, [key]: val }));

  const setLuggagePreset = (value: string) => {
    setForm((f) => ({
      ...f,
      luggagePreset: value,
      luggage: value && value !== "Custom" ? value : f.luggage,
    }));
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const passengerCount = Math.max(1, Number.parseInt(form.passengers, 10) || 1);
      const luggageValue = form.luggagePreset === "Custom" ? form.luggage.trim() : form.luggagePreset || form.luggage.trim();

      const data: NewBooking = {
        travel_date: form.travel_date || null,
        travel_time: form.travel_time ? `${form.travel_time}:00` : null,
        pickup_time: form.travel_date ? new Date(`${form.travel_date}T${form.travel_time}:00`).toISOString() : null,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone || null,
        customer_email: form.customer_email || null,
        airport: form.airport || null,
        dropoff_address: form.dropoff_address || null,
        direction: form.direction || null,
        flight_number: form.flight_number || null,
        passengers: passengerCount,
        luggage: luggageValue || null,
        driver_id: form.driver_id || null,
        assigned_driver_id: form.driver_id || null,
        quoted_price: form.quoted_price ? Number(form.quoted_price) : null,
        notes: form.notes || null,
        priority: form.priority,
        status: form.driver_id ? "Dispatched" : "Unassigned",
        payment_status: "Unpaid",
        return_journey: false,
      };
      await onSave(data);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 fade-in">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md bg-navy-800 rounded-2xl border border-white/10 shadow-card overflow-y-auto max-h-[90vh] slide-up"
      >
        <div className="sticky top-0 bg-navy-800 border-b border-white/8 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-base font-bold text-slate-100">New Transfer</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-navy-700">
            <X size={16} />
          </button>
        </div>

        {prefill && (
          <div className="mx-5 mt-4 px-3 py-2 rounded-lg bg-gold/10 border border-gold/20 text-xs text-gold">
            Pre-filled from quote request — review before creating
          </div>
        )}

        <div className="px-5 py-4 space-y-4">
          <section>
            <SectionLabel icon={Calendar} label="Pick-up Date & Time" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Input type="date" value={form.travel_date} onChange={(v) => set("travel_date", v)} required />
              <Input type="time" value={form.travel_time} onChange={(v) => set("travel_time", v)} required />
            </div>
          </section>

          <section>
            <SectionLabel icon={Users} label="Customer" />
            <div className="space-y-2 mt-2">
              <Input placeholder="Full name *" value={form.customer_name} onChange={(v) => set("customer_name", v)} required />
              <Input placeholder="Phone number" type="tel" value={form.customer_phone} onChange={(v) => set("customer_phone", v)} />
              <Input placeholder="Email address" type="email" value={form.customer_email} onChange={(v) => set("customer_email", v)} />
            </div>
          </section>

          <section>
            <SectionLabel icon={MapPin} label="Route" />
            <div className="space-y-2 mt-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Direction</label>
                <select value={form.direction} onChange={(e) => set("direction", e.target.value)} className={inputCls}>
                  {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <Input placeholder="Airport / pickup address *" value={form.airport} onChange={(v) => set("airport", v)} required />
              <Input placeholder="Drop-off address *" value={form.dropoff_address} onChange={(v) => set("dropoff_address", v)} required />
            </div>
          </section>

          <section>
            <SectionLabel icon={Briefcase} label="Passengers & Bags" />
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Passengers</label>
                <Input type="number" min={1} placeholder="1" value={form.passengers} onChange={(v) => set("passengers", v)} required />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Bags</label>
                <select value={form.luggagePreset} onChange={(e) => setLuggagePreset(e.target.value)} className={inputCls}>
                  <option value="">Select bags</option>
                  {BAG_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
            </div>
            {form.luggagePreset === "Custom" && (
              <div className="mt-2">
                <Input placeholder="Describe luggage e.g. 2 cases + pram" value={form.luggage} onChange={(v) => set("luggage", v)} />
              </div>
            )}
          </section>

          <section>
            <SectionLabel icon={Plane} label="Flight (optional)" />
            <div className="mt-2">
              <Input placeholder="Flight number e.g. BA1490" value={form.flight_number} onChange={(v) => set("flight_number", v)} />
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Driver</label>
              <select value={form.driver_id} onChange={(e) => set("driver_id", e.target.value)} className={inputCls}>
                <option value="">Unassigned</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Price (£)</label>
              <Input type="number" placeholder="0" value={form.quoted_price} onChange={(v) => set("quoted_price", v)} />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.priority}
              onChange={(e) => set("priority", e.target.checked)}
              className="w-4 h-4 accent-gold rounded"
            />
            <span className="text-xs text-slate-400">Mark as priority</span>
          </label>

          <div>
            <label className="text-xs text-slate-500 mb-1 block">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              placeholder="Special instructions, meet & greet, etc."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-navy-800 border-t border-white/8 px-5 py-4 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/15 text-sm text-slate-300 hover:bg-navy-700 transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gold-gradient text-navy-900 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {submitting ? "Creating…" : "Create Booking"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full bg-navy-700 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-colors";

function Input({ placeholder, value, onChange, type = "text", required, min }: {
  placeholder?: string; value: string | number; onChange: (v: string) => void; type?: string; required?: boolean; min?: number;
}) {
  return (
    <input
      type={type}
      min={min}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={inputCls}
    />
  );
}

function SectionLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
      <Icon size={11} className="text-gold/70" />
      {label}
    </div>
  );
}
