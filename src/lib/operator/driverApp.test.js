import { describe, it, expect } from "vitest";
import { dispatchJobToDriverApp, updateJobStatus } from "./driverApp";

// The driver app receives job updates via Supabase Realtime subscriptions on
// the bookings table (filtered by assigned_driver_id), so these are no-op
// stubs kept for call-site compatibility — no REST push is performed.

const SAMPLE_JOB = {
  bookingRef: "EVX-TEST01",
  customer: "Test Customer",
  route: "MAN → Blackpool",
  flight: "EK017",
  pickupTime: "2025-07-01T10:00:00Z",
  price: "£160",
  driver: "Test Driver",
  status: "Dispatched",
};

describe("dispatchJobToDriverApp", () => {
  it("resolves with ok: true", async () => {
    const result = await dispatchJobToDriverApp(SAMPLE_JOB);
    expect(result).toEqual({ ok: true });
  });
});

describe("updateJobStatus", () => {
  it("resolves with ok: true", async () => {
    const result = await updateJobStatus("EVX-TEST01", "En Route");
    expect(result).toEqual({ ok: true });
  });
});
