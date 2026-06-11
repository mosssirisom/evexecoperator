/**
 * Shared persistence for the operator-configurable settings stored in
 * localStorage. Centralised here so pages outside Settings.jsx (e.g.
 * BookingModal, LiveDispatch, useBookings) can read the same values
 * without duplicating the storage key, default shape, and fallback logic.
 */

export const STORAGE_KEY = "evexec_settings";

// Fired on `window` whenever settings are saved, so other open views can
// pick up the change without a full page reload.
export const SETTINGS_CHANGED_EVENT = "evexec-settings-changed";

export const INITIAL = {
  business: {
    name: "EV Exec",
    email: "operator@evexec.co.uk",
    phone: "+44 1253 000000",
    address: "Blackpool, Lancashire, UK",
  },
  notifications: {
    newBooking: true,
    missedCall: true,
    driverStatus: true,
    flightDelay: true,
    dailySummary: false,
    weeklyReport: false,
  },
  fleet: {
    rateMan: "£160",
    rateLpl: "£145",
    rateWaiting: "£15",
    rateChildSeat: "£10",
    showPrices: true,
    autoAssign: false,
  },
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL;
    const saved = JSON.parse(raw);
    return {
      business: { ...INITIAL.business, ...saved.business },
      notifications: { ...INITIAL.notifications, ...saved.notifications },
      fleet: { ...INITIAL.fleet, ...saved.fleet },
    };
  } catch {
    return INITIAL;
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event(SETTINGS_CHANGED_EVENT));
}

export function getFleetSettings() {
  return loadSettings().fleet;
}

/** Parses a "£160" style string into a positive integer, or null if invalid/zero. */
export function parseRate(value) {
  const n = parseInt(String(value || "").replace(/[^0-9]/g, ""), 10);
  return n > 0 ? n : null;
}
