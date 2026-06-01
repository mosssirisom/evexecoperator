// ─── Canonical status enums ────────────────────────────────────────────────────

export const BOOKING_STATUSES = [
  "Unassigned",
  "Dispatched",
  "En Route",
  "Passenger On Board",
  "Completed",
  "Cancelled",
  "Unassigned / Missed Call Recovery",
];

export const DRIVER_STATUSES = [
  "Available",
  "Available soon",
  "En route",
  "Passenger onboard",
  "Off duty",
];

// State machine: maps each status to the set of valid next statuses.
// Cancellation is allowed from any non-terminal state.
// Completed and Cancelled are terminal — no further transitions permitted.
export const STATUS_TRANSITIONS = {
  "Unassigned":                        ["Dispatched", "Cancelled", "Unassigned / Missed Call Recovery"],
  "Unassigned / Missed Call Recovery": ["Dispatched", "Cancelled"],
  "Dispatched":                        ["En Route", "Cancelled"],
  "En Route":                          ["Passenger On Board", "Cancelled"],
  "Passenger On Board":                ["Completed", "Cancelled"],
  "Completed":                         [],
  "Cancelled":                         [],
};

// ─── ValidationError ──────────────────────────────────────────────────────────

export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}

// ─── Status transition guard ──────────────────────────────────────────────────

/**
 * Throws ValidationError if the transition from → to is not permitted by the
 * state machine. Silently passes when `from` is falsy (new records).
 */
export function validateStatusTransition(from, to) {
  if (!from) return;

  const allowed = STATUS_TRANSITIONS[from];
  if (allowed === undefined) {
    throw new ValidationError(`Unknown source status: "${from}"`);
  }
  if (!allowed.includes(to)) {
    const allowedStr = allowed.length
      ? allowed.join(", ")
      : "none — this is a terminal state";
    throw new ValidationError(
      `Cannot transition from "${from}" to "${to}". Allowed: ${allowedStr}`
    );
  }
}

// ─── Booking payload validation ───────────────────────────────────────────────

const MAX_LENGTHS = {
  customer: 120,
  phone:    30,
  email:    254,
  flight:   12,
  notes:    500,
};

/**
 * Validates a raw booking form object before any database operation.
 * Throws ValidationError on the first violation found.
 */
export function validateBookingPayload(form) {
  if (!form || typeof form !== "object") {
    throw new ValidationError("Booking payload must be an object");
  }

  const customer = form.customer?.trim() ?? "";
  if (!customer)
    throw new ValidationError("Customer name is required", "customer");
  if (customer.length > MAX_LENGTHS.customer)
    throw new ValidationError(
      `Customer name must be ≤ ${MAX_LENGTHS.customer} characters`,
      "customer"
    );

  const phone = form.phone?.trim() ?? "";
  if (!phone)
    throw new ValidationError("Phone number is required", "phone");
  if (phone.length > MAX_LENGTHS.phone)
    throw new ValidationError(
      `Phone must be ≤ ${MAX_LENGTHS.phone} characters`,
      "phone"
    );

  if (form.email && form.email.trim().length > MAX_LENGTHS.email)
    throw new ValidationError(
      `Email must be ≤ ${MAX_LENGTHS.email} characters`,
      "email"
    );

  if (!form.airport)
    throw new ValidationError("Airport is required", "airport");

  if (!form.destination)
    throw new ValidationError("Destination is required", "destination");

  if (form.destination === "Custom address…" && !form.customAddress?.trim())
    throw new ValidationError("Custom address text is required", "customAddress");

  if (!form.date)
    throw new ValidationError("Pickup date is required", "date");

  if (!form.time)
    throw new ValidationError("Pickup time is required", "time");

  const pickup = new Date(`${form.date}T${form.time}`);
  if (isNaN(pickup.getTime()))
    throw new ValidationError("Invalid pickup date or time", "date");

  const now = Date.now();
  if (pickup.getTime() < now - 24 * 60 * 60 * 1000)
    throw new ValidationError(
      "Pickup time cannot be more than 24 hours in the past",
      "date"
    );
  if (pickup.getTime() > now + 2 * 365 * 24 * 60 * 60 * 1000)
    throw new ValidationError(
      "Pickup time is unreasonably far in the future (> 2 years)",
      "date"
    );

  if (form.price !== null && form.price !== undefined && form.price !== "") {
    const price = Number(form.price);
    if (isNaN(price) || price < 0)
      throw new ValidationError("Price must be a non-negative number", "price");
    if (price > 10_000)
      throw new ValidationError("Price exceeds the allowed maximum (£10,000)", "price");
  }

  if (form.flight && form.flight.trim().length > MAX_LENGTHS.flight)
    throw new ValidationError(
      `Flight number must be ≤ ${MAX_LENGTHS.flight} characters`,
      "flight"
    );

  if (form.notes && form.notes.length > MAX_LENGTHS.notes)
    throw new ValidationError(
      `Notes must be ≤ ${MAX_LENGTHS.notes} characters`,
      "notes"
    );
}

// ─── Text sanitisation ────────────────────────────────────────────────────────

/** Trims whitespace and hard-caps a string to maxLen characters. */
export function sanitizeText(str, maxLen) {
  if (typeof str !== "string") return str;
  return str.trim().slice(0, maxLen);
}

// ─── Booking reference generation ────────────────────────────────────────────

/**
 * Generates a short unique booking reference of the form EVX-XXXXXNN.
 * Uses timestamp + random suffix to minimise collision probability.
 * The caller should still handle the rare unique-constraint DB error by retrying.
 */
export function generateBookingRef() {
  const ts  = Date.now().toString(36).toUpperCase().slice(-6);
  const rnd = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `EVX-${ts}${rnd}`;
}
