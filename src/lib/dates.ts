// House date style for every EV Exec screen and message (user decision,
// 2026-10-04): dates DD/MM/YYYY, times 24-hour HH:MM, UK time.

const UK = "Europe/London";

/** A plain YYYY-MM-DD date as DD/MM/YYYY (rearranged directly, so no
 *  timezone can shift the day). Anything else is treated as a timestamp. */
export function fmtDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: UK });
}

/** A timestamp's time as 24-hour HH:MM, UK time. */
export function fmtTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: UK });
}

/** A timestamp as DD/MM/YYYY HH:MM, UK time. */
export function fmtDateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  return `${fmtDate(value instanceof Date ? value : new Date(value))} ${fmtTime(value)}`;
}

/** Short weekday + date, e.g. "Mon 05/10/2026" (dispatch/day headers). */
export function fmtDayDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : value instanceof Date ? value : new Date(value);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: UK });
  return `${day} ${fmtDate(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : d)}`;
}
