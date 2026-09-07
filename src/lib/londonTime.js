/**
 * All booking pickup times are entered by an operator as UK local
 * wall-clock time (a plain <input type="time"> value like "14:30") and must
 * be stored and shown back EXACTLY as typed -- never re-interpreted through
 * a timezone. The failure mode this file exists to prevent: constructing a
 * `new Date("2026-09-14T14:30")` and later formatting it with
 * `toLocaleTimeString`/`toLocaleString` with no explicit `timeZone` option.
 * That round-trips correctly only if the browser doing the formatting
 * happens to be set to Europe/London at that exact moment; on any other
 * device it silently shifts by an hour whenever the UK is on BST (British
 * Summer Time, UTC+1) -- which is most of the year -- producing exactly a
 * "customer booked at 2:30pm, got told 1:30pm" bug with no error anywhere.
 *
 * Fix: never let a stored/displayed time pass through an ambient-timezone
 * Date conversion. Use `formatLondonTimeText` (pure string parsing, no Date
 * object at all) wherever the raw travel_time/travel_date text is
 * available, and `londonWallTimeToUtcIso`/`toLondonTimeText` (both
 * explicitly pinned to Europe/London) only where a timestamptz like
 * pickup_time is all that's available.
 */

/** Minutes to add to a UTC instant to get Europe/London local time at that instant (handles BST/GMT). */
function londonOffsetMinutes(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/London",
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  })
    .formatToParts(date)
    .reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  const asUtc = Date.UTC(
    +parts.year, +parts.month - 1, +parts.day,
    +parts.hour, +parts.minute, +parts.second
  );
  return (asUtc - date.getTime()) / 60000;
}

/**
 * Converts a UK local wall-clock date + time, exactly as an operator typed
 * them (e.g. "2026-09-14", "14:30"), into the correct UTC ISO instant --
 * accounting for BST/GMT so this is correct year-round. Used only to
 * populate pickup_time (a timestamptz needed for range queries/sorting);
 * the source of truth for display is always the raw travel_date/travel_time
 * text, never this derived value.
 */
export function londonWallTimeToUtcIso(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = String(dateStr).split("-").map(Number);
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!y || !m || !d || !match) return null;
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const guessUtc = Date.UTC(y, m - 1, d, hh, mm);
  const offset = londonOffsetMinutes(new Date(guessUtc));
  return new Date(guessUtc - offset * 60000).toISOString();
}

/** Extracts "HH:MM" from a raw travel_time string verbatim -- no Date object, no timezone, ever. */
export function formatLondonTimeText(timeStr) {
  if (!timeStr) return null;
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(timeStr);
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Formats "YYYY-MM-DD" as "14 September 2026" by parsing the string directly -- no Date object, so no risk of a UTC-midnight day rollover. */
export function formatLondonDateText(dateStr) {
  if (!dateStr) return null;
  const match = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(dateStr);
  const [, y, m, d] = match;
  const month = MONTHS[Number(m) - 1];
  return month ? `${Number(d)} ${month} ${y}` : String(dateStr);
}

/**
 * Last-resort formatter for when only a timestamptz (e.g. pickup_time) is
 * available and there's no raw travel_time/travel_date text to show
 * verbatim -- explicitly pinned to Europe/London so it's still correct
 * regardless of the viewing device's own timezone.
 */
export function toLondonTimeText(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
  });
}

export function toLondonDateTimeText(iso, opts = {}) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    ...opts,
    timeZone: "Europe/London",
  });
}
