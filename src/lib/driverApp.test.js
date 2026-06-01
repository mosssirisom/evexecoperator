import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { dispatchJobToDriverApp, updateJobStatus } from "./driverApp";

const SAMPLE_JOB = {
  bookingRef: "EVX-TEST01",
  customer: "Test Customer",
  route: "MAN → Blackpool",
  flight: "EK017",
  pickupTime: "2025-07-01T10:00:00Z",
  price: "£160",
  driver: "Test Driver",
};

// ─── Demo mode (no env var) ───────────────────────────────────────────────────

describe("demo mode", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_DRIVER_APP_URL", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("dispatchJobToDriverApp returns a mock success response", async () => {
    const result = await dispatchJobToDriverApp(SAMPLE_JOB);
    expect(result.ok).toBe(true);
    expect(result.mock).toBe(true);
    expect(result.jobId).toBe(SAMPLE_JOB.bookingRef);
  });

  it("updateJobStatus returns a mock success response", async () => {
    const result = await updateJobStatus("EVX-TEST01", "En Route");
    expect(result.ok).toBe(true);
    expect(result.mock).toBe(true);
  });
});

// ─── Live mode (env var set) ──────────────────────────────────────────────────

describe("live mode", () => {
  const FAKE_URL = "https://fake-driver-app.test";

  beforeEach(() => {
    vi.stubEnv("VITE_DRIVER_APP_URL", FAKE_URL);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("dispatchJobToDriverApp succeeds on a 200 response", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "abc" }), { status: 200 })
    );

    const result = await dispatchJobToDriverApp(SAMPLE_JOB);
    expect(result.id).toBe("abc");
    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}/api/jobs`,
      expect.objectContaining({ method: "POST" })
    );
  });

  it("throws immediately on a 400 client error (no retry)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("Bad Request", { status: 400 })
    );

    await expect(dispatchJobToDriverApp(SAMPLE_JOB)).rejects.toThrow(/400/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries on 503 and succeeds on the second attempt", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(new Response("Service Unavailable", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "retry-ok" }), { status: 200 }));

    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection
    const promise = dispatchJobToDriverApp(SAMPLE_JOB);
    await vi.advanceTimersByTimeAsync(600); // past first backoff (500ms)
    const result = await promise;

    expect(result.id).toBe("retry-ok");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting all retries on persistent 500", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response("Internal Server Error", { status: 500 })
    );

    const promise = dispatchJobToDriverApp(SAMPLE_JOB);
    // Attach rejection handler synchronously before timers fire
    const assertion = expect(promise).rejects.toThrow(/500/);
    await vi.advanceTimersByTimeAsync(5000); // past all retry backoffs
    await assertion;

    // Initial attempt + 2 retries = 3 total calls
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("updateJobStatus calls PATCH /api/jobs/:ref", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ updated: true }), { status: 200 })
    );

    const result = await updateJobStatus("EVX-TEST01", "En Route");
    expect(result.updated).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      `${FAKE_URL}/api/jobs/EVX-TEST01`,
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("updateJobStatus URL-encodes the booking ref", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    );
    await updateJobStatus("EVX-TEST/01", "Cancelled");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("EVX-TEST%2F01"),
      expect.any(Object)
    );
  });
});
