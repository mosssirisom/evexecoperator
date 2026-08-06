"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  FileText, Plus, X, Printer, Trash2, Check, Send, CircleDollarSign, Clock,
  MapPin, Plane, Users, Briefcase, Car, CalendarClock,
} from "lucide-react";
import { useInvoices, computeTotals } from "@/hooks/operator/useInvoices";
import { useBookings } from "@/hooks/operator/useBookings";
import { useOperatorToast } from "@/components/operator/Toast";

const VAT_RATES = [
  { label: "No VAT", value: 0 },
  { label: "VAT 20%", value: 0.2 },
];

const money = (n) => `£${(Number(n) || 0).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);

function statusChip(status) {
  switch (status) {
    case "Paid":  return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
    case "Sent":  return "border-blue-400/30 bg-blue-400/10 text-blue-300";
    case "Void":  return "border-slate-500/30 bg-slate-500/10 text-slate-400";
    default:      return "border-amber-400/30 bg-amber-400/10 text-amber-300"; // Draft
  }
}

// Human date/time for the printed sheet.
function niceDate(d) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
function journeyHasContent(j) {
  return j && (j.pickup || j.dropoff || j.date || j.time || j.flight || j.passengers || j.luggage || j.vehicle || j.returnDate);
}

const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 outline-none transition focus:border-amber-400/40";
const labelCls = "mb-1.5 text-[10px] uppercase tracking-[0.2em] text-slate-500";

/* ─── Create-invoice modal ──────────────────────────────────────────────── */
function InvoiceModal({ open, onClose, onCreate, bookings }) {
  const blankItem = { description: "", quantity: 1, unit_price: "" };
  const emptyJourney = { pickup: "", dropoff: "", date: "", time: "", flight: "", passengers: "", luggage: "", vehicle: "", returnDate: "", returnTime: "" };
  const [customer, setCustomer] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [journey, setJourney] = useState({ ...emptyJourney });
  const [items, setItems] = useState([{ ...blankItem }]);
  const [vatRate, setVatRate] = useState(0);
  const [issueDate, setIssueDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const reset = () => {
    setCustomer(""); setEmail(""); setPhone(""); setAddress(""); setBookingRef("");
    setJourney({ ...emptyJourney });
    setItems([{ ...blankItem }]); setVatRate(0); setIssueDate(today()); setDueDate("");
    setNotes(""); setErr(null);
  };

  const setJ = (key, val) => setJourney((prev) => ({ ...prev, [key]: val }));

  const prefillFromBooking = (ref) => {
    setBookingRef(ref);
    if (!ref) { setJourney({ ...emptyJourney }); return; }
    const b = bookings.find((x) => x.id === ref);
    if (!b) return;
    setCustomer(b.customer || "");
    setPhone(b.phone && b.phone !== "—" ? b.phone : "");
    setEmail(b.email && b.email !== "—" ? b.email : "");

    const pickup = b.pickupLocation && b.pickupLocation !== "—" ? b.pickupLocation : (b.airport && b.airport !== "—" ? b.airport : "");
    const dropoff = b.dropoffAddress && b.dropoffAddress !== "—" ? b.dropoffAddress : "";
    const j = {
      pickup,
      dropoff,
      date: b.travelDate || "",
      time: b.time && b.time !== "—" ? b.time : "",
      flight: b.flight && b.flight !== "—" ? b.flight : "",
      passengers: b.passengers != null ? String(b.passengers) : "",
      luggage: b.luggage != null ? String(b.luggage) : "",
      vehicle: b.vehicleType && b.vehicleType !== "—" ? b.vehicleType : "",
      returnDate: b.returnJourney && b.returnDate ? b.returnDate : "",
      returnTime: b.returnJourney && b.returnTime ? b.returnTime : "",
    };
    setJourney(j);

    const routeText = b.route && b.route !== "—" ? b.route : [pickup, dropoff].filter(Boolean).join(" → ");
    const price = b.price && b.price !== "TBC" ? Number(String(b.price).replace(/[^0-9.]/g, "")) : "";
    const desc = `Airport transfer${routeText ? ` — ${routeText}` : ""}`;
    const seeded = [{ description: desc, quantity: 1, unit_price: price }];
    if (b.returnJourney && b.returnRoute) {
      seeded.push({ description: `Return transfer — ${b.returnRoute}`, quantity: 1, unit_price: "" });
    }
    setItems(seeded);
  };

  const setItem = (i, key, val) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [key]: val } : it)));
  const addItem = () => setItems((prev) => [...prev, { ...blankItem }]);
  const removeItem = (i) => setItems((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));

  const totals = useMemo(() => computeTotals(items, vatRate), [items, vatRate]);

  const submit = async () => {
    if (!customer.trim()) { setErr("Customer name is required."); return; }
    if (!items.some((it) => it.description.trim() && Number(it.unit_price) > 0)) {
      setErr("Add at least one line item with a description and amount."); return;
    }
    setBusy(true); setErr(null);
    try {
      const cleanItems = items
        .filter((it) => it.description.trim())
        .map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0 }));
      // Keep only journey fields the operator actually filled in.
      const cleanJourney = Object.fromEntries(
        Object.entries(journey).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]).filter(([, v]) => v !== "" && v != null)
      );
      await onCreate({
        customer, email, phone, address, bookingRef: bookingRef || null,
        journey: cleanJourney,
        lineItems: cleanItems, vatRate, issueDate, dueDate: dueDate || null, notes, status: "Draft",
      });
      reset();
      onClose();
    } catch (e) {
      setErr(e?.message ?? "Failed to create invoice.");
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#070D1F] sm:max-w-lg sm:rounded-3xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-white/5 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">New Invoice</h2>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {bookings.length > 0 && (
            <div>
              <p className={labelCls}>Prefill from booking</p>
              <select value={bookingRef} onChange={(e) => prefillFromBooking(e.target.value)} className={inputCls}>
                <option value="">— none (manual) —</option>
                {bookings.slice(0, 60).map((b) => (
                  <option key={b.id} value={b.id}>{b.id} · {b.customer} · {b.price}</option>
                ))}
              </select>
              <p className="mt-1 text-[10px] text-slate-600">Pulls in the customer, journey and price — you can edit anything below.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className={labelCls}>Customer name *</p>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} className={inputCls} placeholder="Customer or company" />
            </div>
            <div>
              <p className={labelCls}>Email</p>
              <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="name@email.com" />
            </div>
            <div>
              <p className={labelCls}>Phone</p>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="Phone" />
            </div>
            <div className="col-span-2">
              <p className={labelCls}>Billing address</p>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="Address (optional)" />
            </div>
          </div>

          {/* Journey details — the heart of an airport-transfer invoice */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-400/80">
              <MapPin className="h-3 w-3" /> Journey details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <p className={labelCls}>Pickup address</p>
                <input value={journey.pickup} onChange={(e) => setJ("pickup", e.target.value)} className={inputCls} placeholder="e.g. 12 High St, Guildford GU1" />
              </div>
              <div className="col-span-2">
                <p className={labelCls}>Drop-off address</p>
                <input value={journey.dropoff} onChange={(e) => setJ("dropoff", e.target.value)} className={inputCls} placeholder="e.g. Heathrow Terminal 5" />
              </div>
              <div>
                <p className={labelCls}>Date</p>
                <input type="date" value={journey.date} onChange={(e) => setJ("date", e.target.value)} className={inputCls} />
              </div>
              <div>
                <p className={labelCls}>Pickup time</p>
                <input value={journey.time} onChange={(e) => setJ("time", e.target.value)} className={inputCls} placeholder="e.g. 06:30" />
              </div>
              <div>
                <p className={labelCls}>Flight no.</p>
                <input value={journey.flight} onChange={(e) => setJ("flight", e.target.value)} className={inputCls} placeholder="e.g. BA2772" />
              </div>
              <div>
                <p className={labelCls}>Vehicle</p>
                <input value={journey.vehicle} onChange={(e) => setJ("vehicle", e.target.value)} className={inputCls} placeholder="e.g. Executive" />
              </div>
              <div>
                <p className={labelCls}>Passengers</p>
                <input value={journey.passengers} onChange={(e) => setJ("passengers", e.target.value)} inputMode="numeric" className={inputCls} placeholder="e.g. 2" />
              </div>
              <div>
                <p className={labelCls}>Luggage</p>
                <input value={journey.luggage} onChange={(e) => setJ("luggage", e.target.value)} inputMode="numeric" className={inputCls} placeholder="e.g. 3" />
              </div>
            </div>
          </div>

          {/* Line items — what's being charged */}
          <div>
            <p className={labelCls}>Charges</p>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-start gap-2">
                  <input value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} className={inputCls + " flex-1"} placeholder="What's being charged" />
                  <input value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} inputMode="numeric" className={inputCls + " w-14 text-center"} placeholder="Qty" />
                  <input value={it.unit_price} onChange={(e) => setItem(i, "unit_price", e.target.value)} inputMode="decimal" className={inputCls + " w-20"} placeholder="£" />
                  <button onClick={() => removeItem(i)} className="mt-1 flex-shrink-0 text-slate-600 hover:text-red-300" title="Remove line"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200">
              <Plus className="h-3.5 w-3.5" /> Add charge
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className={labelCls}>VAT</p>
              <select value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} className={inputCls}>
                {VAT_RATES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <p className={labelCls}>Issue date</p>
              <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <p className={labelCls}>Due date</p>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <div>
            <p className={labelCls}>Notes / payment terms</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={inputCls} placeholder="e.g. Payment due within 14 days. Bank: …" />
          </div>

          {/* Totals preview */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 text-sm">
            <div className="flex justify-between text-slate-400"><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
            {vatRate > 0 && <div className="mt-1 flex justify-between text-slate-400"><span>VAT ({Math.round(vatRate * 100)}%)</span><span>{money(totals.vatAmount)}</span></div>}
            <div className="mt-2 flex justify-between border-t border-white/5 pt-2 text-base font-semibold text-white"><span>Total</span><span className="text-amber-300">{money(totals.total)}</span></div>
          </div>

          {err && <p className="rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">{err}</p>}
        </div>

        <div className="flex flex-shrink-0 gap-2 border-t border-white/5 px-5 py-4">
          <button onClick={onClose} disabled={busy} className="flex-1 rounded-2xl border border-white/10 py-3 text-sm font-semibold text-slate-300 hover:border-white/20 disabled:opacity-50">Cancel</button>
          <button onClick={submit} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60">
            {busy ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Journey block for the printed sheet ───────────────────────────────── */
function JourneyDetails({ journey: j }) {
  if (!journeyHasContent(j)) return null;
  const rows = [
    { icon: MapPin, label: "Pickup", value: j.pickup },
    { icon: MapPin, label: "Drop-off", value: j.dropoff },
    { icon: CalendarClock, label: "Date & time", value: [niceDate(j.date), j.time].filter(Boolean).join(" · ") || null },
    { icon: Plane, label: "Flight", value: j.flight },
    { icon: Car, label: "Vehicle", value: j.vehicle },
    { icon: Users, label: "Passengers", value: j.passengers },
    { icon: Briefcase, label: "Luggage", value: j.luggage },
    { icon: CalendarClock, label: "Return", value: j.returnDate ? [niceDate(j.returnDate), j.returnTime].filter(Boolean).join(" · ") : null },
  ].filter((r) => r.value);

  return (
    <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Journey details</p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start gap-2">
            <r.icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
            <div className="min-w-0">
              <span className="text-slate-500">{r.label}: </span>
              <span className="font-medium text-slate-800">{r.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Printable invoice preview ─────────────────────────────────────────── */
function InvoicePreview({ invoice, onClose, onStatus, onDelete }) {
  const inv = invoice;
  return (
    <div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl">
        {/* Action bar — hidden when printing */}
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
          <button onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:text-white">← Back</button>
          <div className="flex flex-wrap items-center gap-2">
            {inv.status !== "Sent" && inv.status !== "Paid" && (
              <button onClick={() => onStatus(inv.id, "Sent")} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-400/30 bg-blue-400/10 px-3 py-2 text-xs font-medium text-blue-300 hover:bg-blue-400/20"><Send className="h-3.5 w-3.5" />Mark Sent</button>
            )}
            {inv.status !== "Paid" && (
              <button onClick={() => onStatus(inv.id, "Paid")} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-400/20"><Check className="h-3.5 w-3.5" />Mark Paid</button>
            )}
            {inv.status !== "Void" && (
              <button onClick={() => onStatus(inv.id, "Void")} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-400 hover:text-white">Void</button>
            )}
            <button onClick={() => onDelete(inv)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"><Trash2 className="h-3.5 w-3.5" />Delete</button>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-black hover:bg-amber-400"><Printer className="h-3.5 w-3.5" />Print / Save PDF</button>
          </div>
        </div>

        {/* The invoice sheet — white document, prints on its own */}
        <div className="invoice-print rounded-2xl bg-white p-8 text-slate-900 shadow-2xl sm:p-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-black tracking-tight">EV EXEC</p>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Executive Airport Transfers</p>
              <p className="mt-2 text-xs text-slate-500">evexec.co.uk · bookings@evexec.co.uk</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold text-slate-800">INVOICE</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{inv.number}</p>
              <span className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                inv.status === "Paid" ? "border-emerald-500 text-emerald-700"
                : inv.status === "Sent" ? "border-blue-500 text-blue-700"
                : inv.status === "Void" ? "border-slate-400 text-slate-500"
                : "border-amber-500 text-amber-700"}`}>{inv.status}</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bill to</p>
              <p className="mt-1 font-semibold text-slate-800">{inv.customer}</p>
              {inv.address && <p className="text-slate-600">{inv.address}</p>}
              {inv.email && <p className="text-slate-600">{inv.email}</p>}
              {inv.phone && <p className="text-slate-600">{inv.phone}</p>}
            </div>
            <div className="text-right">
              <p className="text-slate-500">Issue date: <span className="font-medium text-slate-800">{niceDate(inv.issueDate) || inv.issueDate || "—"}</span></p>
              {inv.dueDate && <p className="mt-1 text-slate-500">Due date: <span className="font-medium text-slate-800">{niceDate(inv.dueDate) || inv.dueDate}</span></p>}
              {inv.bookingRef && <p className="mt-1 text-slate-500">Booking ref: <span className="font-medium text-slate-800">{inv.bookingRef}</span></p>}
            </div>
          </div>

          <JourneyDetails journey={inv.journey} />

          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-400">
                <th className="pb-2">Description</th>
                <th className="pb-2 text-center">Qty</th>
                <th className="pb-2 text-right">Unit</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.lineItems.map((li, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2.5 text-slate-700">{li.description}</td>
                  <td className="py-2.5 text-center text-slate-600">{li.quantity}</td>
                  <td className="py-2.5 text-right text-slate-600">{money(li.unit_price)}</td>
                  <td className="py-2.5 text-right font-medium text-slate-800">{money((Number(li.quantity) || 0) * (Number(li.unit_price) || 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between text-slate-500"><span>Subtotal</span><span>{money(inv.subtotal)}</span></div>
              {inv.vatRate > 0 && <div className="flex justify-between text-slate-500"><span>VAT ({Math.round(inv.vatRate * 100)}%)</span><span>{money(inv.vatAmount)}</span></div>}
              <div className="flex justify-between border-t-2 border-slate-200 pt-2 text-base font-bold text-slate-900"><span>Total due</span><span>{money(inv.total)}</span></div>
            </div>
          </div>

          {inv.notes && (
            <div className="mt-8 border-t border-slate-100 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{inv.notes}</p>
            </div>
          )}

          <p className="mt-8 text-center text-xs text-slate-400">Thank you for travelling with EV Exec.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function InvoicesPage() {
  const { invoices, loading, createInvoice, updateStatus, deleteInvoice } = useInvoices();
  const { bookings } = useBookings();
  const toast = useOperatorToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [filter, setFilter] = useState("All");

  const stats = useMemo(() => {
    const outstanding = invoices.filter((i) => i.status === "Draft" || i.status === "Sent").reduce((a, i) => a + i.total, 0);
    const paid = invoices.filter((i) => i.status === "Paid").reduce((a, i) => a + i.total, 0);
    const unpaidCount = invoices.filter((i) => i.status === "Draft" || i.status === "Sent").length;
    return { outstanding, paid, unpaidCount };
  }, [invoices]);

  const filtered = useMemo(
    () => (filter === "All" ? invoices : invoices.filter((i) => i.status === filter)),
    [invoices, filter]
  );

  const handleCreate = useCallback(async (form) => {
    const inv = await createInvoice(form);
    toast({ message: `Invoice ${inv.number} created`, type: "success" });
    setPreview(inv);
    return inv;
  }, [createInvoice, toast]);

  const handleStatus = useCallback(async (id, status) => {
    try {
      await updateStatus(id, status);
      setPreview((p) => (p?.id === id ? { ...p, status } : p));
      toast({ message: `Invoice marked ${status}`, type: "success" });
    } catch (e) {
      toast({ message: e?.message ?? "Failed to update", type: "error" });
    }
  }, [updateStatus, toast]);

  const handleDelete = useCallback(async (inv) => {
    if (!confirm(`Delete invoice ${inv.number}? This cannot be undone.`)) return;
    try {
      await deleteInvoice(inv.id);
      setPreview(null);
      toast({ message: `Invoice ${inv.number} deleted`, type: "success" });
    } catch (e) {
      toast({ message: e?.message ?? "Failed to delete", type: "error" });
    }
  }, [deleteInvoice, toast]);

  return (
    <>
      {/* Print isolation: only the invoice sheet prints */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .invoice-print, .invoice-print * { visibility: visible !important; }
        .invoice-print { position: absolute; left: 0; top: 0; width: 100%; box-shadow: none !important; border-radius: 0 !important; }
        .no-print { display: none !important; }
      }`}</style>

      <div className="grid gap-4 p-4 sm:gap-6 sm:p-6 lg:p-10">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[
            { label: "Outstanding", value: money(stats.outstanding), icon: Clock, color: "text-amber-300" },
            { label: "Paid", value: money(stats.paid), icon: CircleDollarSign, color: "text-emerald-300" },
            { label: "Unpaid", value: stats.unpaidCount, icon: FileText, color: "text-white" },
          ].map((s) => (
            <div key={s.label} className="card p-3 sm:p-5">
              <div className="mb-2 flex items-center justify-between">
                <s.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${s.color}`} />
              </div>
              <p className={`text-lg font-bold sm:text-2xl ${s.color}`}>{s.value}</p>
              <p className="mt-1 text-[11px] text-slate-500 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Header + New */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-400">Billing</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">Invoices</h2>
          </div>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-amber-400 sm:px-5 sm:py-3">
            <Plus className="h-4 w-4" /> New Invoice
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-1.5">
          {["All", "Draft", "Sent", "Paid", "Void"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filter === f ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-white/10 text-slate-500 hover:text-slate-300"}`}>
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="card p-3 sm:p-4">
          {loading && invoices.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-600">Loading invoices…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14">
              <FileText className="mb-3 h-8 w-8 text-slate-700" />
              <p className="text-sm text-slate-600">{invoices.length === 0 ? "No invoices yet." : `No ${filter.toLowerCase()} invoices.`}</p>
              {invoices.length === 0 && (
                <button onClick={() => setModalOpen(true)} className="mt-4 rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-400 hover:text-amber-300">
                  + Create your first invoice
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((inv) => (
                <button key={inv.id} onClick={() => setPreview(inv)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-3 text-left transition hover:border-amber-400/20 hover:bg-white/[0.03]">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
                    <FileText className="h-4 w-4 text-amber-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{inv.customer}</p>
                    <p className="truncate text-xs text-slate-500">
                      {inv.number}{inv.issueDate ? ` · ${inv.issueDate}` : ""}
                      {inv.journey?.pickup || inv.journey?.dropoff ? ` · ${[inv.journey.pickup, inv.journey.dropoff].filter(Boolean).join(" → ")}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-bold text-amber-300">{money(inv.total)}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusChip(inv.status)}`}>{inv.status}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <InvoiceModal open={modalOpen} onClose={() => setModalOpen(false)} onCreate={handleCreate} bookings={bookings} />
      {preview && (
        <InvoicePreview invoice={preview} onClose={() => setPreview(null)} onStatus={handleStatus} onDelete={handleDelete} />
      )}
    </>
  );
}
