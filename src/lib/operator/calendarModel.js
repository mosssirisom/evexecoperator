// Pure logic behind the operator calendar (Bookings → Calendar).
//
// Works on the shaped bookings from hooks/operator/useBookings and reuses the
// shared definitions in bookingBuckets, so the calendar, the list and the
// board always agree on what "awaiting reply" or "needs a driver" means.
//
// Every calendar date is a UK wall-clock date string, YYYY-MM-DD (the same
// form as booking.travelDate). Date maths is done on UTC noon so no device
// timezone or clock change can move a booking onto the wrong day.

import { awaitingReply, needsDriver, isPast, unpaidCompleted, DONE_STATUSES, ON_ROAD_STATUSES } from "./bookingBuckets";
import { CLASH_BUFFER_MINUTES, looksLikeAirport } from "../bookingUtils";

// ── Date keys ────────────────────────────────────────────────────────────────

const KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const isKey = (k) => typeof k === "string" && KEY_RE.test(k);

function toDate(key) {
  const [, y, m, d] = key.match(KEY_RE);
  return new Date(Date.UTC(+y, +m - 1, +d, 12));
}
function fromDate(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(key, n) {
  const d = toDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(key) {
  return (toDate(key).getUTCDay() + 6) % 7;
}

export const startOfWeek = (key) => addDays(key, -weekdayIndex(key));
export const startOfMonth = (key) => `${key.slice(0, 7)}-01`;
export function endOfMonth(key) {
  const d = toDate(startOfMonth(key));
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return fromDate(d);
}
export function addMonths(key, n) {
  const d = toDate(startOfMonth(key));
  d.setUTCMonth(d.getUTCMonth() + n);
  const target = fromDate(d);
  // Keep the day of month where possible (31st → last day of a short month).
  const day = Math.min(+key.slice(8, 10), +endOfMonth(target).slice(8, 10));
  return `${target.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

/** Every key from start to end inclusive. */
export function eachDay(start, end) {
  const out = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

/** The Monday-first weeks covering a month, as rows of 7 keys. */
export function monthWeeks(key) {
  const first = startOfWeek(startOfMonth(key));
  const last = addDays(startOfWeek(endOfMonth(key)), 6);
  const days = eachDay(first, last);
  const rows = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));
  return rows;
}

const dm = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
const dmy = (key) => `${dm(key)}/${key.slice(0, 4)}`;
// House style (CLAUDE.md): never a written-out month — months read MM/YYYY.
export const monthTitle = (key) => `${key.slice(5, 7)}/${key.slice(0, 4)}`;
export const dayOfMonth = (key) => +key.slice(8, 10);
export const weekdayShort = (key) => WEEKDAYS_SHORT[weekdayIndex(key)];
export const weekdayLong = (key) => WEEKDAYS_LONG[weekdayIndex(key)];
/** "Thursday 15/10/2026" — house style keeps dates DD/MM/YYYY. */
export const longDay = (key) => `${weekdayLong(key)} ${dmy(key)}`;
export const shortDay = (key) => `${weekdayShort(key)} ${dm(key)}`;

// ── Periods ──────────────────────────────────────────────────────────────────

export const VIEWS = ["month", "week", "day", "list"];

/** The date range a view covers around the cursor date. List = the month. */
export function periodFor(view, cursor) {
  if (view === "day") return { view, start: cursor, end: cursor, title: dmy(cursor), subtitle: weekdayLong(cursor) };
  if (view === "week") {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const from = start.slice(0, 4) !== end.slice(0, 4) ? dmy(start) : start.slice(0, 7) === end.slice(0, 7) ? start.slice(8, 10) : dm(start);
    return { view, start, end, title: `${from}–${dmy(end)}`, subtitle: "Week" };
  }
  return { view, start: startOfMonth(cursor), end: endOfMonth(cursor), title: monthTitle(cursor), subtitle: view === "list" ? "Agenda" : "Month" };
}

/** Where Previous / Next moves the cursor in each view. */
export function stepCursor(view, cursor, dir) {
  if (view === "day") return addDays(cursor, dir);
  if (view === "week") return addDays(cursor, 7 * dir);
  return addMonths(cursor, dir);
}

// ── Times ────────────────────────────────────────────────────────────────────

export function minutesOf(time) {
  const m = String(time ?? "").match(/^(\d{1,2}):(\d{2})/);
  return m ? +m[1] * 60 + +m[2] : null;
}

export function formatGap(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

// ── Booking state and flags ─────────────────────────────────────────────────

/**
 * Where a booking stands, for colour and grouping:
 *  reply     website request still to accept or decline  ("pending")
 *  driver    confirmed but no driver                     ("unassigned")
 *  assigned  driver on it, not yet on the road
 *  road      en route / arrived / passenger on board
 *  done      completed or no-show
 *  cancelled
 */
export function bookingState(b) {
  if (b.status === "Cancelled") return "cancelled";
  if (awaitingReply(b)) return "reply";
  if (ON_ROAD_STATUSES.includes(b.status)) return "road";
  if (DONE_STATUSES.includes(b.status)) return "done";
  if (needsDriver(b)) return "driver";
  return "assigned";
}

export const STATE_LABEL = {
  reply: "Awaiting reply",
  driver: "Needs driver",
  assigned: "Driver assigned",
  road: "On the road",
  done: "Completed",
  cancelled: "Cancelled",
};

export function isAirportJob(b) {
  return Boolean(
    b.airport ||
    (b.flight && b.flight !== "—") ||
    looksLikeAirport(b.pickupLocation) ||
    looksLikeAirport(b.dropoffAddress)
  );
}

/** Numeric fare. Prefers the raw value; falls back to the "£95" display string. */
export function fareOf(b) {
  if (typeof b.priceValue === "number" && Number.isFinite(b.priceValue)) return b.priceValue;
  const m = String(b.price ?? "").match(/£\s*([\d,.]+)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

/** Same-driver jobs on the same day closer together than the clash buffer. */
export function findClashes(bookings) {
  const groups = new Map();
  for (const b of bookings) {
    if (!b.driverId || !b.travelDate) continue;
    if (b.status === "Cancelled" || DONE_STATUSES.includes(b.status)) continue;
    const mins = minutesOf(b.time);
    if (mins == null) continue;
    const k = `${b.driverId}|${b.travelDate}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ b, mins });
  }
  const clashes = new Map(); // booking id → the other booking
  for (const list of groups.values()) {
    list.sort((x, y) => x.mins - y.mins);
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1];
      const cur = list[i];
      if (cur.mins - prev.mins < CLASH_BUFFER_MINUTES) {
        if (!clashes.has(prev.b.id)) clashes.set(prev.b.id, cur.b);
        if (!clashes.has(cur.b.id)) clashes.set(cur.b.id, prev.b);
      }
    }
  }
  return clashes;
}

/**
 * Adds calendar fields to each booking: state, isAirport, fare, minutes, and
 * `flags` — the operational warnings shown on the calendar. `attention` is
 * true when any flag needs the office to act.
 *
 * ctx: { today: YYYY-MM-DD, now: ms, unavailableDriverIds?: (date) => Set }
 */
export function enrichBookings(bookings, ctx) {
  const { today, now = Date.now(), unavailableDriverIds } = ctx;
  const clashes = findClashes(bookings);
  return bookings.map((b) => {
    const state = bookingState(b);
    const past = isPast(b, today);
    const flags = [];
    if (state === "reply") flags.push({ code: "reply", tone: "wait", label: "Awaiting your reply" });
    if (state === "driver" && !past) {
      const t = b.pickupTime ? new Date(b.pickupTime).getTime() : NaN;
      const hours = Number.isNaN(t) ? null : (t - now) / 3600000;
      if (hours != null && hours >= 0 && hours <= 24) {
        flags.push({ code: "urgent", tone: "alert", label: `No driver · pickup in ${formatGap(Math.max(1, Math.round(hours * 60)))}` });
      } else {
        flags.push({ code: "driver", tone: "alert", label: "No driver assigned" });
      }
    }
    const other = clashes.get(b.id);
    if (other) flags.push({ code: "clash", tone: "alert", label: `Clashes with ${other.id} at ${other.time}` });
    if (b.driverId && b.travelDate && state !== "cancelled" && state !== "done" && unavailableDriverIds?.(b.travelDate)?.has(b.driverId)) {
      flags.push({ code: "unavailable", tone: "alert", label: `${b.driver} marked this day unavailable` });
    }
    if (minutesOf(b.time) == null && state !== "cancelled" && !past) flags.push({ code: "notime", tone: "wait", label: "No pickup time" });
    if (unpaidCompleted(b)) flags.push({ code: "unpaid", tone: "wait", label: "Completed, not paid" });

    return {
      ...b,
      state,
      past,
      isAirport: isAirportJob(b),
      fare: fareOf(b),
      minutes: minutesOf(b.time),
      flags,
      attention: flags.length > 0,
    };
  });
}

// ── Filtering ───────────────────────────────────────────────────────────────

export const STATUS_FILTERS = {
  all: () => true,
  confirmed: (b) => b.state !== "reply" && b.state !== "cancelled",
  reply: (b) => b.state === "reply",
  driver: (b) => b.state === "driver" && !b.past,
  attention: (b) => b.attention,
};

export function matchesSearch(b, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [b.id, b.customer, b.flight, b.route, b.driver, b.phone, b.pickupLocation, b.dropoffAddress, b.airport]
    .some((v) => v && String(v).toLowerCase().includes(s));
}

/** filters: { status, driver: "all" | "none" | driverId, query, showCancelled } */
export function applyFilters(bookings, { status = "all", driver = "all", query = "", showCancelled = false }) {
  const byStatus = STATUS_FILTERS[status] ?? STATUS_FILTERS.all;
  return bookings.filter((b) => {
    if (b.state === "cancelled" && !showCancelled) return false;
    if (!byStatus(b)) return false;
    if (driver === "none" && b.driverId) return false;
    if (driver !== "all" && driver !== "none" && b.driverId !== driver) return false;
    return matchesSearch(b, query);
  });
}

// ── Grouping and metrics ────────────────────────────────────────────────────

const byTime = (a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999) || String(a.id).localeCompare(String(b.id));

/** date → bookings sorted by pickup time. Undated bookings are left out. */
export function groupByDate(bookings) {
  const map = new Map();
  for (const b of bookings) {
    if (!b.travelDate) continue;
    if (!map.has(b.travelDate)) map.set(b.travelDate, []);
    map.get(b.travelDate).push(b);
  }
  for (const list of map.values()) list.sort(byTime);
  return map;
}

export const inPeriod = (b, p) => Boolean(b.travelDate) && b.travelDate >= p.start && b.travelDate <= p.end;

/** Counts for the summary strip. Cancelled jobs never count. */
export function periodMetrics(bookings) {
  const live = bookings.filter((b) => b.state !== "cancelled");
  let revenue = 0;
  let unpriced = 0;
  for (const b of live) {
    if (b.fare == null) unpriced++;
    else revenue += b.fare;
  }
  return {
    total: live.length,
    confirmed: live.filter(STATUS_FILTERS.confirmed).length,
    reply: live.filter(STATUS_FILTERS.reply).length,
    driver: live.filter(STATUS_FILTERS.driver).length,
    attention: live.filter(STATUS_FILTERS.attention).length,
    airport: live.filter((b) => b.isAirport).length,
    revenue,
    unpriced,
  };
}

/** Per-day dot summary for the month grid. */
export function daySummary(list) {
  const live = list.filter((b) => b.state !== "cancelled");
  const count = (s) => live.filter((b) => b.state === s).length;
  return {
    total: live.length,
    reply: count("reply"),
    driver: live.filter(STATUS_FILTERS.driver).length,
    confirmed: live.filter(STATUS_FILTERS.confirmed).length,
    airport: live.filter((b) => b.isAirport).length,
    attention: live.some((b) => b.attention),
  };
}

/** Jobs per driver on one day, plus the unassigned count, for the day view. */
export function driverLoad(dayBookings) {
  const live = dayBookings.filter((b) => b.state !== "cancelled");
  const map = new Map();
  let unassigned = 0;
  for (const b of live) {
    if (!b.driverId) { unassigned++; continue; }
    if (!map.has(b.driverId)) map.set(b.driverId, { id: b.driverId, name: b.driver, jobs: [] });
    map.get(b.driverId).jobs.push(b);
  }
  const drivers = [...map.values()].sort((a, b) => b.jobs.length - a.jobs.length || a.name.localeCompare(b.name));
  return { drivers, unassigned };
}

/** Free time between consecutive timed pickups (shown in the day view when long). */
export function gapBefore(list, index) {
  const cur = list[index];
  const prev = list[index - 1];
  if (!prev || prev.minutes == null || cur.minutes == null) return null;
  return cur.minutes - prev.minutes;
}

// ── Data coverage ───────────────────────────────────────────────────────────

/**
 * Whether the loaded bookings fully cover a period, so the strip never shows a
 * confident number for a range that hasn't been loaded.
 *  windowStart  first date the operational query loads (older = loadEarlier)
 *  hasEarlier   older bookings may still exist
 *  moreForward  later bookings exist beyond the loaded page
 *  lastLoaded   latest travel date loaded
 */
export function coverage(period, { windowStart, hasEarlier, moreForward, lastLoaded }) {
  const missingEarlier = Boolean(hasEarlier && windowStart && period.start < windowStart);
  const missingLater = Boolean(moreForward && lastLoaded && period.end > lastLoaded);
  return { complete: !missingEarlier && !missingLater, missingEarlier, missingLater };
}
