import React, { useEffect } from "react";
import { X, Printer } from "lucide-react";

function fmt(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function InvoiceModal({ booking, onClose }) {
  useEffect(() => {
    if (!booking) return;
    const style = document.createElement("style");
    style.id = "invoice-print-style";
    style.textContent = `
      @media print {
        body > *:not(#invoice-print-root) { display: none !important; }
        #invoice-print-root { display: block !important; position: fixed; inset: 0; background: white; padding: 40px; z-index: 9999; }
        #invoice-print-root .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.getElementById("invoice-print-style")?.remove();
  }, [booking]);

  if (!booking) return null;

  const isPaid = booking.paymentStatus === "Paid";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        id="invoice-print-root"
        className="fixed inset-x-4 top-[5vh] z-[60] mx-auto max-w-2xl overflow-auto rounded-3xl border border-white/10 bg-white shadow-2xl sm:inset-x-auto sm:left-1/2 sm:w-full sm:-translate-x-1/2"
        style={{ maxHeight: "90vh" }}
      >
        {/* Screen header */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <p className="text-sm font-semibold text-slate-800">Invoice / Receipt</p>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              <Printer className="h-4 w-4" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Invoice body */}
        <div className="bg-white px-8 py-8 text-slate-800 sm:px-10 sm:py-10">
          {/* Company header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-bold tracking-tight text-slate-900">EV Exec</p>
              <p className="mt-0.5 text-sm text-slate-500">Premium Electric Airport Transfers</p>
              <p className="mt-3 text-xs text-slate-500 leading-relaxed">
                hello@evexec.co.uk<br />
                evexec.co.uk
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                isPaid
                  ? "bg-emerald-100 text-emerald-700"
                  : booking.paymentStatus === "Invoiced"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-red-100 text-red-700"
              }`}>
                <span className={`h-2 w-2 rounded-full ${isPaid ? "bg-emerald-500" : booking.paymentStatus === "Invoiced" ? "bg-amber-500" : "bg-red-500"}`} />
                {booking.paymentStatus ?? "Unpaid"}
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-slate-400">Invoice</p>
              <p className="text-base font-bold text-slate-900">{booking.id}</p>
              <p className="mt-1 text-xs text-slate-500">
                Issued: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="my-8 border-t border-slate-200" />

          {/* Bill to */}
          <div className="mb-8">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Bill To</p>
            <p className="text-base font-semibold text-slate-900">{booking.customer}</p>
            {booking.phone && <p className="mt-0.5 text-sm text-slate-600">{booking.phone}</p>}
            {booking.email && <p className="mt-0.5 text-sm text-slate-600">{booking.email}</p>}
          </div>

          {/* Journey details table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Service</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">Airport Transfer</p>
                    <p className="mt-0.5 text-xs text-slate-500">{booking.route}</p>
                    {booking.flight && booking.flight !== "—" && (
                      <p className="mt-0.5 text-xs text-slate-500">Flight: {booking.flight}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-500">Pickup: {fmt(booking.pickupTime)}</p>
                    <p className="mt-0.5 text-xs text-slate-500">Driver: {booking.driver}</p>
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {booking.price}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-slate-50">
                <tr className="border-t border-slate-200">
                  <td className="px-5 py-3 text-right text-sm font-semibold text-slate-700">Total (incl. VAT)</td>
                  <td className="px-5 py-3 text-right text-base font-bold text-slate-900">{booking.price}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Notes */}
          {booking.notes && (
            <div className="mt-6">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Notes</p>
              <p className="text-sm text-slate-600">{booking.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            <p>Thank you for choosing EV Exec — premium electric airport transfers.</p>
            <p className="mt-1">evexec.co.uk · hello@evexec.co.uk</p>
          </div>
        </div>
      </div>
    </>
  );
}
