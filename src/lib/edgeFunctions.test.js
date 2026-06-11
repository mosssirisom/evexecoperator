import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Pure message builders ─────────────────────────────────────────────────

describe("bookingConfirmationSms", () => {
  it("includes customer first name, route, time, driver and ref", async () => {
    const { bookingConfirmationSms } = await import("./edgeFunctions");

    const msg = bookingConfirmationSms({
      customer: "James Whitmore",
      route: "Manchester Airport → Blackpool",
      pickupTime: "2025-07-01T10:45:00.000Z",
      driver: "Nitisat Siri",
      id: "EVX-1234",
    });

    expect(msg).toContain("Hi James,");
    expect(msg).toContain("Manchester Airport → Blackpool");
    expect(msg).toContain("Nitisat Siri");
    expect(msg).toContain("EVX-1234");
  });

  it("falls back to TBC and 'Being arranged' when unset", async () => {
    const { bookingConfirmationSms } = await import("./edgeFunctions");

    const msg = bookingConfirmationSms({
      customer: "Jane Doe",
      route: "LPL → Lytham",
      pickupTime: null,
      driver: "Unassigned",
      id: "EVX-5",
    });

    expect(msg).toContain("TBC");
    expect(msg).toContain("Being arranged");
  });
});

describe("missedCallRecoverySms", () => {
  it("returns a generic recovery message mentioning EV Exec", async () => {
    const { missedCallRecoverySms } = await import("./edgeFunctions");
    const msg = missedCallRecoverySms();
    expect(msg).toContain("EV Exec");
    expect(msg).toContain("evexec.co.uk");
  });
});

// ─── invoke() wrapper — not configured ─────────────────────────────────────

describe("when Supabase is not configured", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("./supabase", () => ({ supabase: null, isConfigured: false }));
  });

  it("sendSms returns a not-configured response without calling Supabase", async () => {
    const { sendSms } = await import("./edgeFunctions");
    const result = await sendSms({ to: "+44 7700 900000", message: "hi" });
    expect(result).toEqual({ ok: false, configured: false, reason: "Supabase not configured" });
  });

  it("getIntegrationStatus returns a not-configured response", async () => {
    const { getIntegrationStatus } = await import("./edgeFunctions");
    const result = await getIntegrationStatus();
    expect(result).toEqual({ ok: false, configured: false, reason: "Supabase not configured" });
  });
});

// ─── invoke() wrapper — configured ─────────────────────────────────────────

describe("when Supabase is configured", () => {
  const mockInvoke = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    mockInvoke.mockReset();
    vi.doMock("./supabase", () => ({
      supabase: { functions: { invoke: mockInvoke } },
      isConfigured: true,
    }));
  });

  it("sendSms returns the function's data on success", async () => {
    mockInvoke.mockResolvedValueOnce({ data: { ok: true, sid: "SM123" }, error: null });

    const { sendSms } = await import("./edgeFunctions");
    const result = await sendSms({ to: "+44 7700 900000", message: "hi", bookingRef: "EVX-1" });

    expect(mockInvoke).toHaveBeenCalledWith("send-sms", {
      body: { to: "+44 7700 900000", message: "hi", bookingRef: "EVX-1" },
    });
    expect(result).toEqual({ ok: true, sid: "SM123" });
  });

  it("checkFlight returns ok:false with the error message when Supabase errors", async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });

    const { checkFlight } = await import("./edgeFunctions");
    const result = await checkFlight({ flightNumber: "EK017" });

    expect(result).toEqual({ ok: false, configured: false, reason: "boom" });
  });

  it("createPaymentLink returns ok:false when invoke throws", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("network down"));

    const { createPaymentLink } = await import("./edgeFunctions");
    const result = await createPaymentLink({
      bookingRef: "EVX-1",
      amount: 16000,
      description: "Airport transfer",
    });

    expect(result).toEqual({ ok: false, configured: false, reason: "network down" });
  });

  it("getIntegrationStatus calls the integration-status function and returns its payload", async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { ok: true, integrations: { twilio: true, stripe: false, aerodatabox: true } },
      error: null,
    });

    const { getIntegrationStatus } = await import("./edgeFunctions");
    const result = await getIntegrationStatus();

    expect(mockInvoke).toHaveBeenCalledWith("integration-status", { body: {} });
    expect(result.integrations).toEqual({ twilio: true, stripe: false, aerodatabox: true });
  });
});
