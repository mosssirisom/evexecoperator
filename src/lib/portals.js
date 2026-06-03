// Central registry of all external portal / website URLs.
// Each entry reads from an env var first, then falls back to the known default.
// Override any of these by setting the corresponding VITE_* variable.

export const PORTALS = {
  driverApp: {
    label: "Driver Portal",
    description: "Live dispatch app used by drivers — view jobs, update status, navigate",
    url: import.meta.env.VITE_DRIVER_APP_URL ?? "https://evexecdriverapp.vercel.app",
    envKey: "VITE_DRIVER_APP_URL",
  },
  bookingForm: {
    label: "Customer Booking Form",
    description: "Public-facing booking page customers use to request a transfer",
    url: import.meta.env.VITE_BOOKING_FORM_URL ?? "https://evexec.co.uk/book",
    envKey: "VITE_BOOKING_FORM_URL",
  },
  customerAccount: {
    label: "My Account (Customer Portal)",
    description: "Customers log in to view bookings, invoices and saved preferences",
    url: import.meta.env.VITE_CUSTOMER_PORTAL_URL ?? "https://evexec.co.uk/account",
    envKey: "VITE_CUSTOMER_PORTAL_URL",
  },
  website: {
    label: "Main Website",
    description: "Public homepage — marketing, pricing and service information",
    url: import.meta.env.VITE_WEBSITE_URL ?? "https://evexec.co.uk",
    envKey: "VITE_WEBSITE_URL",
  },
};

export function openPortal(key) {
  const portal = PORTALS[key];
  if (portal?.url) window.open(portal.url, "_blank", "noopener,noreferrer");
}

export function driverJobUrl(bookingRef) {
  const base = PORTALS.driverApp.url.replace(/\/$/, "");
  return `${base}/jobs/${encodeURIComponent(bookingRef)}`;
}
