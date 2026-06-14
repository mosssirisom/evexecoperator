"use client";

import { useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Inbox,
  PhoneMissed,
  Phone,
  Mail,
  MapPin,
  Plane,
  Calendar,
  Clock,
  Users,
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  ArrowLeftRight,
} from "lucide-react";
import type { DbQuoteRequest, DbMissedCall, DbContactMessage } from "@/lib/database.types";

interface Props {
  quoteRequests: DbQuoteRequest[];
  missedCalls: DbMissedCall[];
  contactMessages: DbContactMessage[];
  onDismissQuote: (id: string) => void;
  onConvertQuote: (quote: DbQuoteRequest) => void;
  onToggleMissedCall: (id: string, resolved: boolean) => void;
  onToggleContactMessage: (id: string, read: boolean) => void;
}

export default function InboxTab({
  quoteRequests,
  missedCalls,
  contactMessages,
  onDismissQuote,
  onConvertQuote,
  onToggleMissedCall,
  onToggleContactMessage,
}: Props) {
  const [showResolved, setShowResolved] = useState(false);
  const [showRead, setShowRead] = useState(false);

  const newQuotes = quoteRequests.filter((q) => !q.status || q.status === "new");
  const visibleCalls = showResolved ? missedCalls : missedCalls.filter((c) => !c.resolved);
  const visibleMessages = showRead ? contactMessages : contactMessages.filter((m) => m.status !== "read");

  return (
    <div className="space-y-5">
      {/* Quote Requests */}
      <section className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Inbox size={16} className="text-gold/70" />
            Quote Requests
          </h2>
          <span className="text-xs text-slate-500">{newQuotes.length} new</span>
        </div>

        {newQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-white/10 text-slate-600">
            <Inbox size={24} className="mb-2 text-slate-700" />
            <p className="text-sm">No new quote requests</p>
          </div>
        ) : (
          newQuotes.map((quote) => (
            <QuoteRequestCard
              key={quote.id}
              quote={quote}
              onDismiss={() => onDismissQuote(quote.id)}
              onConvert={() => onConvertQuote(quote)}
            />
          ))
        )}
      </section>

      {/* Missed Calls */}
      <section className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <PhoneMissed size={16} className="text-gold/70" />
            Missed Calls
          </h2>
          <button
            onClick={() => setShowResolved((s) => !s)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showResolved ? "Hide resolved" : "Show resolved"}
          </button>
        </div>

        {visibleCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-white/10 text-slate-600">
            <PhoneMissed size={24} className="mb-2 text-slate-700" />
            <p className="text-sm">{showResolved ? "No missed calls" : "No unresolved missed calls"}</p>
          </div>
        ) : (
          visibleCalls.map((call) => (
            <MissedCallCard
              key={call.id}
              call={call}
              onToggleResolved={() => onToggleMissedCall(call.id, !call.resolved)}
            />
          ))
        )}
      </section>

      {/* Contact Messages */}
      <section className="space-y-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Mail size={16} className="text-gold/70" />
            Messages
          </h2>
          <button
            onClick={() => setShowRead((s) => !s)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showRead ? "Hide read" : "Show read"}
          </button>
        </div>

        {visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 rounded-2xl border border-dashed border-white/10 text-slate-600">
            <Mail size={24} className="mb-2 text-slate-700" />
            <p className="text-sm">{showRead ? "No messages" : "No new messages"}</p>
          </div>
        ) : (
          visibleMessages.map((message) => (
            <ContactMessageCard
              key={message.id}
              message={message}
              onToggleRead={() => onToggleContactMessage(message.id, message.status !== "read")}
            />
          ))
        )}
      </section>
    </div>
  );
}

function QuoteRequestCard({
  quote,
  onDismiss,
  onConvert,
}: {
  quote: DbQuoteRequest;
  onDismiss: () => void;
  onConvert: () => void;
}) {
  const from  = quote.airport ?? quote.pickup_location ?? "—";
  const to    = quote.destination ?? "—";
  const route = `${from.split(",")[0]} → ${to.split(",")[0]}`;

  const dateLabel = quote.pickup_date ? format(parseISO(quote.pickup_date), "EEE d MMM") : null;
  const timeLabel = quote.pickup_time?.slice(0, 5);

  const created = quote.created_at
    ? formatDistanceToNow(parseISO(quote.created_at), { addSuffix: true })
    : null;

  return (
    <div className="rounded-2xl border border-white/8 bg-navy-800 shadow-card overflow-hidden">
      <div className="px-4 pt-3 pb-4 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-100 text-sm leading-tight">{quote.customer_name}</p>
            <div className="flex items-start gap-1.5 mt-1">
              <MapPin size={12} className="text-gold/60 mt-0.5 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">{route}</p>
            </div>
          </div>
          {created && <span className="text-[10px] text-slate-600 shrink-0 whitespace-nowrap">{created}</span>}
        </div>

        {/* Date / time / passengers */}
        <div className="flex items-center gap-3 flex-wrap">
          {dateLabel && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Calendar size={11} className="text-gold/60" /> {dateLabel}
            </span>
          )}
          {timeLabel && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={11} className="text-gold/60" /> {timeLabel}
            </span>
          )}
          {quote.passengers != null && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Users size={11} className="text-gold/60" /> {quote.passengers}
            </span>
          )}
        </div>

        {/* Flight info */}
        {quote.flight_number && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-900/20 border border-white/5">
            <Plane size={12} className="text-blue-400 shrink-0 -rotate-45" />
            <span className="text-xs font-bold text-blue-300 tracking-wide">{quote.flight_number}</span>
          </div>
        )}

        {/* Return trip */}
        {quote.return_required && (
          <div className="flex items-center gap-1.5 text-xs text-purple-300 bg-purple-900/20 px-3 py-1.5 rounded-lg">
            <ArrowLeftRight size={11} className="shrink-0" />
            Return{quote.return_date ? ` on ${format(parseISO(quote.return_date), "d MMM")}` : ""}
            {quote.return_time ? ` at ${quote.return_time.slice(0, 5)}` : ""}
          </div>
        )}

        {/* Phone */}
        <div className="flex items-center gap-1.5">
          <Phone size={11} className="text-gold/60 shrink-0" />
          <span className="text-xs text-slate-400">{quote.phone}</span>
          {quote.contact_method && (
            <span className="text-[10px] text-slate-600 ml-1">via {quote.contact_method}</span>
          )}
        </div>

        {/* Notes */}
        {quote.notes && (
          <div className="flex items-start gap-1.5">
            <MessageSquare size={11} className="text-gold/60 shrink-0 mt-0.5" />
            <span className="text-xs text-slate-400 italic">{quote.notes}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onDismiss}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-navy-700 text-slate-400 border border-white/10 hover:bg-navy-600 hover:text-slate-200 active:scale-[0.98] transition-all"
          >
            Dismiss
          </button>
          <button
            onClick={onConvert}
            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-gold/10 text-gold border border-gold/25 hover:bg-gold/20 hover:border-gold/40 active:scale-[0.98] transition-all"
          >
            Create Booking
          </button>
        </div>
      </div>
    </div>
  );
}

function MissedCallCard({
  call,
  onToggleResolved,
}: {
  call: DbMissedCall;
  onToggleResolved: () => void;
}) {
  const created = call.created_at
    ? formatDistanceToNow(parseISO(call.created_at), { addSuffix: true })
    : null;

  return (
    <div
      className={`rounded-2xl border bg-navy-800 shadow-card overflow-hidden px-4 py-3 ${
        call.resolved ? "border-white/8 opacity-60" : "border-orange-500/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Phone size={12} className="text-orange-400 shrink-0" />
            <p className="font-semibold text-slate-100 text-sm">{call.caller ?? "Unknown number"}</p>
          </div>
          {call.notes && <p className="text-xs text-slate-400 italic mt-1">{call.notes}</p>}
          <div className="flex items-center gap-3 mt-1.5">
            {call.attempts != null && (
              <span className="text-[10px] text-slate-500">
                {call.attempts} attempt{call.attempts !== 1 ? "s" : ""}
              </span>
            )}
            {created && <span className="text-[10px] text-slate-600">{created}</span>}
          </div>
        </div>
        <button
          onClick={onToggleResolved}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
            call.resolved
              ? "bg-navy-700 text-slate-400 border border-white/10 hover:bg-navy-600"
              : "bg-orange-900/30 text-orange-300 border border-orange-500/25 hover:bg-orange-900/50"
          }`}
        >
          {call.resolved ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
          {call.resolved ? "Reopen" : "Resolve"}
        </button>
      </div>
    </div>
  );
}

function ContactMessageCard({
  message,
  onToggleRead,
}: {
  message: DbContactMessage;
  onToggleRead: () => void;
}) {
  const isRead = message.status === "read";
  const created = message.created_at
    ? formatDistanceToNow(parseISO(message.created_at), { addSuffix: true })
    : null;

  return (
    <div
      className={`rounded-2xl border bg-navy-800 shadow-card overflow-hidden px-4 py-3 ${
        isRead ? "border-white/8 opacity-60" : "border-blue-500/20"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-slate-100 text-sm">{message.name}</p>
            {created && <span className="text-[10px] text-slate-600 shrink-0 whitespace-nowrap">{created}</span>}
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {message.phone && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Phone size={11} className="text-gold/60" /> {message.phone}
              </span>
            )}
            {message.email && (
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Mail size={11} className="text-gold/60" /> {message.email}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 italic mt-1.5 leading-relaxed">{message.message}</p>
        </div>
        <button
          onClick={onToggleRead}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-[0.98] ${
            isRead
              ? "bg-navy-700 text-slate-400 border border-white/10 hover:bg-navy-600"
              : "bg-blue-900/30 text-blue-300 border border-blue-500/25 hover:bg-blue-900/50"
          }`}
        >
          {isRead ? <RotateCcw size={11} /> : <CheckCircle2 size={11} />}
          {isRead ? "Reopen" : "Mark read"}
        </button>
      </div>
    </div>
  );
}
