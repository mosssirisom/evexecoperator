"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Copy, CheckCircle2, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useOperatorToast } from "@/components/operator/Toast";

const NAVY = "#0B132B";
const GOLD = "#d7a23f";

function longDate(d) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function OperatorSmsTaskPage() {
  const { id } = useParams();
  const router = useRouter();
  const toast = useOperatorToast();

  const [task, setTask] = useState(null);
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: t } = await supabase
        .from("operator_sms_tasks")
        .select("id, booking_id, kind, customer_name, customer_phone, message, status, sent_at")
        .eq("id", id)
        .maybeSingle();

      if (!t) { if (!cancelled) { setNotFound(true); setLoading(false); } return; }

      const { data: b } = await supabase
        .from("bookings")
        .select("ref, travel_date, travel_time, pickup_location, dropoff_address, airport, flight_number, passengers")
        .eq("id", t.booking_id)
        .maybeSingle();

      if (cancelled) return;
      setTask(t);
      setBooking(b ?? null);
      setLoading(false);

      if (t.status === "pending") {
        const { data: updated } = await supabase
          .from("operator_sms_tasks")
          .update({ status: "opened", opened_at: new Date().toISOString() })
          .eq("id", t.id)
          .select("id, booking_id, kind, customer_name, customer_phone, message, status, sent_at")
          .maybeSingle();
        if (updated && !cancelled) setTask(updated);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  const markAsSent = useCallback(async () => {
    if (!task || marking) return;
    setMarking(true);
    const { data: updated } = await supabase
      .from("operator_sms_tasks")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", task.id)
      .select("id, booking_id, kind, customer_name, customer_phone, message, status, sent_at")
      .maybeSingle();
    if (updated) setTask(updated);
    setMarking(false);
  }, [task, marking]);

  const copyMessage = useCallback(async () => {
    if (!task) return;
    try {
      await navigator.clipboard.writeText(task.message);
      toast?.({ message: "Message copied to clipboard.", type: "success" });
    } catch {
      toast?.({ message: "Copy failed -- select and copy the text manually.", type: "error" });
    }
  }, [task, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-7 w-7 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (notFound || !task) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <button onClick={() => router.back()} className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
          <ArrowLeft size={16} /> Back
        </button>
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">This SMS task is no longer available.</p>
        </div>
      </div>
    );
  }

  const pickup = booking?.pickup_location || booking?.airport || null;
  const dropoff = booking?.dropoff_address || booking?.airport || null;
  const when = [longDate(booking?.travel_date), booking?.travel_time ? booking.travel_time.slice(0, 5) : null]
    .filter(Boolean)
    .join(" at ");
  const KIND_LABEL = {
    confirmation: "Booking Confirmation",
    rejection: "Journey Unavailable",
    cancellation: "Booking Cancelled",
  };
  const kindLabel = KIND_LABEL[task.kind] || "Customer Update";

  const smsHref = `sms:${task.customer_phone}?body=${encodeURIComponent(task.message)}`;
  const isSent = task.status === "sent";

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <button onClick={() => router.back()} className="mb-6 flex items-center gap-1.5 text-sm text-slate-500">
        <ArrowLeft size={16} /> Back
      </button>

      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        SMS Confirmation Needed &middot; {kindLabel}
      </p>
      <h1 className="mb-6 text-xl font-bold" style={{ color: NAVY }}>
        {task.customer_name || "Customer"}
      </h1>

      {/* Details card */}
      <div className="mb-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <Row label="Customer" value={task.customer_name || "—"} />
        <Row label="Mobile" value={task.customer_phone} icon={<Phone size={13} className="text-slate-400" />} />
        {booking?.ref && <Row label="Reference" value={booking.ref} />}
        {when && <Row label="Pickup" value={when} />}
        {pickup && <Row label="From" value={pickup} />}
        {dropoff && <Row label="To" value={dropoff} />}
        {booking?.flight_number && <Row label="Flight" value={booking.flight_number} />}
        {booking?.passengers > 1 && <Row label="Passengers" value={String(booking.passengers)} />}
      </div>

      {/* Message preview */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Message Preview</p>
        <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: NAVY }}>{task.message}</p>
      </div>

      {!isSent ? (
        <>
          <a
            href={smsHref}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-bold text-[#020813] active:opacity-90"
            style={{ background: `linear-gradient(135deg, #f1c56a, ${GOLD} 55%, #a97918)` }}
          >
            <MessageSquare size={17} />
            Open Messages
          </a>

          <button
            onClick={copyMessage}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-600 active:opacity-70"
          >
            <Copy size={14} />
            Copy Message
          </button>

          <p className="mt-3 text-center text-xs text-slate-400">
            Messages will open with the reminder ready to send.
          </p>

          <button
            onClick={markAsSent}
            disabled={marking}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: NAVY }}
          >
            <CheckCircle2 size={15} />
            {marking ? "Marking as sent…" : "Mark as Sent"}
          </button>
        </>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-500" />
          <p className="text-sm font-semibold" style={{ color: NAVY }}>Marked as sent</p>
          {task.sent_at && (
            <p className="mt-1 text-xs text-slate-400">
              {new Date(task.sent_at).toLocaleString("en-GB", {
                day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, icon }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="flex-shrink-0 pt-0.5 text-xs text-slate-500">{label}</span>
      <span className="flex items-center justify-end gap-1.5 text-right text-sm font-medium" style={{ color: NAVY }}>
        {icon}
        {value}
      </span>
    </div>
  );
}
