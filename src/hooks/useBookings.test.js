import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { ValidationError } from "../lib/validation";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockChain, mockSupabase } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    order:  vi.fn(),
    range:  vi.fn(),
    eq:     vi.fn(),
    single: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));

  const client = {
    from:          vi.fn(() => chain),
    channel:       vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  };

  return { mockChain: chain, mockSupabase: client };
});

vi.mock("../lib/supabase", () => ({
  supabase:     mockSupabase,
  isConfigured: true,
}));

vi.mock("./useRealtimeBookings", () => ({
  useRealtimeBookings: vi.fn(),
  useRealtimeDrivers:  vi.fn(),
}));

vi.mock("../lib/driverApp", () => ({
  dispatchJobToDriverApp: vi.fn().mockResolvedValue({ ok: true }),
  updateJobStatus:        vi.fn().mockResolvedValue({ ok: true }),
}));

import { useBookings, shapedBooking } from "./useBookings";

// ─── Shared setup ─────────────────────────────────────────────────────────────

// Safe defaults: every terminal chain method resolves to a no-error empty response.
// Individual tests override with mockResolvedValueOnce where specific data is needed.
beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mockChain).forEach((fn) => fn.mockReturnValue(mockChain));
  mockChain.range.mockResolvedValue({ data: [], count: 0, error: null });
  mockChain.single.mockResolvedValue({ data: null, error: null });
  mockChain.eq.mockResolvedValue({ data: [], error: null });
  mockChain.insert.mockResolvedValue({ error: null });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tomorrow() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validForm(overrides = {}) {
  return {
    customer: "Test Customer", phone: "+44 7700 900000", email: "",
    direction: "Airport → Destination", airport: "Manchester Airport (MAN)",
    destination: "Blackpool", date: tomorrow(), time: "10:00",
    flight: "EK017", notes: "", price: 160, driver: "",
    ...overrides,
  };
}

// Prime the range mock (the terminal call in fetchBookings) to return `rows`
// for the next N calls. Pass N=2 to survive React 18 strict-mode double-invoke
// of effects.
function primeRows(rows, times = 2) {
  for (let i = 0; i < times; i++) {
    mockChain.range.mockResolvedValueOnce({ data: rows, count: rows.length, error: null });
  }
}

// ─── shapedBooking — pure function ───────────────────────────────────────────

describe("shapedBooking", () => {
  it("maps a full DB row to the display shape", () => {
    const row = {
      ref: "EVX-1234", customer_name: "James Whitmore", flight: "EK017",
      airport: "Manchester Airport", destination: "Blackpool",
      pickup_time: "2025-07-01T10:45:00Z", drivers: { name: "Nitisat Siri" },
      price: 160, status: "Dispatched", priority: false,
      updated_at: "2025-07-01T10:00:00Z",
    };
    const s = shapedBooking(row);

    expect(s.id).toBe("EVX-1234");
    expect(s.customer).toBe("James Whitmore");
    expect(s.flight).toBe("EK017");
    expect(s.route).toBe("Manchester Airport → Blackpool");
    expect(s.driver).toBe("Nitisat Siri");
    expect(s.price).toBe("£160");
    expect(s.status).toBe("Dispatched");
    expect(s.priority).toBe(false);
    expect(s.updatedAt).toBe("2025-07-01T10:00:00Z");
  });

  it("uses fallback values for null optional fields", () => {
    const row = {
      ref: "EVX-0", customer_name: "X", flight: null, airport: null,
      destination: "Somewhere", pickup_time: null, drivers: null,
      price: null, status: "Unassigned", priority: null, updated_at: null,
    };
    const s = shapedBooking(row);
    expect(s.flight).toBe("—");
    expect(s.time).toBe("—");
    expect(s.driver).toBe("Unassigned");
    expect(s.price).toBe("TBC");
    expect(s.priority).toBe(false);
    expect(s.updatedAt).toBeNull();
  });

  it("formats route as airport → destination", () => {
    const row = {
      ref: "X", customer_name: "A", airport: "LPL", destination: "Lytham",
      flight: null, pickup_time: null, drivers: null, price: null,
      status: "Dispatched", priority: false, updated_at: null,
    };
    expect(shapedBooking(row).route).toBe("LPL → Lytham");
  });
});

// ─── createBooking ────────────────────────────────────────────────────────────

describe("useBookings — createBooking", () => {
  it("calls supabase.insert with correct shape for a valid form", async () => {
    const { result } = renderHook(() => useBookings());

    await act(async () => {
      await result.current.createBooking(validForm());
    });

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_name: "Test Customer",
        airport: "Manchester Airport (MAN)",
        destination: "Blackpool",
        status: "Unassigned",
      })
    );
  });

  it("returns a ref matching EVX- format", async () => {
    const { result } = renderHook(() => useBookings());

    let ref;
    await act(async () => {
      ({ ref } = await result.current.createBooking(validForm()));
    });

    expect(ref).toMatch(/^EVX-[A-Z0-9]+$/);
  });

  it("throws ValidationError for missing customer name", async () => {
    const { result } = renderHook(() => useBookings());

    await expect(
      act(() => result.current.createBooking(validForm({ customer: "" })))
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for negative price", async () => {
    const { result } = renderHook(() => useBookings());

    await expect(
      act(() => result.current.createBooking(validForm({ price: -1 })))
    ).rejects.toThrow(ValidationError);
  });

  it("retries on unique-key collision and succeeds on second attempt", async () => {
    const collision = { code: "23505", message: "duplicate key value" };
    // Override: first call fails (collision), second succeeds
    mockChain.insert
      .mockResolvedValueOnce({ error: collision })
      .mockResolvedValueOnce({ error: null });

    const { result } = renderHook(() => useBookings());

    await act(async () => {
      await result.current.createBooking(validForm());
    });

    expect(mockChain.insert).toHaveBeenCalledTimes(2);
  });

  it("throws after 3 consecutive collision failures", async () => {
    const collision = { code: "23505", message: "duplicate key value" };
    mockChain.insert.mockResolvedValue({ error: collision }); // fail every call

    const { result } = renderHook(() => useBookings());

    // Catch inside act so act waits for the full async loop before settling.
    let thrownErr;
    await act(async () => {
      try { await result.current.createBooking(validForm()); }
      catch (e) { thrownErr = e; }
    });

    expect(thrownErr).toBeDefined();
    expect(thrownErr.message).toMatch(/unique booking reference/i);
    expect(mockChain.insert).toHaveBeenCalledTimes(3);
  });

  it("propagates non-collision errors immediately without retry", async () => {
    const permErr = { code: "42501", message: "permission denied" };
    mockChain.insert.mockResolvedValueOnce({ error: permErr });

    const { result } = renderHook(() => useBookings());

    await expect(
      act(() => result.current.createBooking(validForm()))
    ).rejects.toThrow(/permission denied/);

    expect(mockChain.insert).toHaveBeenCalledTimes(1);
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe("useBookings — updateStatus", () => {
  it("throws ValidationError for an unknown status value", async () => {
    const { result } = renderHook(() => useBookings());

    await expect(
      act(() => result.current.updateStatus("EVX-1234", "TakeOff"))
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for a forbidden state-machine transition (Completed → Dispatched)", async () => {
    const completedRow = {
      ref: "EVX-DONE", customer_name: "X", flight: null,
      airport: "A", destination: "B", pickup_time: null,
      drivers: null, price: null, status: "Completed",
      priority: false, updated_at: null,
    };
    // Prime twice to survive React 18 strict-mode double-invoke of effects
    primeRows([completedRow], 2);

    const { result } = renderHook(() => useBookings());

    // Wait for effect + bookingsRef update to settle
    await act(async () => {});

    await expect(
      act(() => result.current.updateStatus("EVX-DONE", "Dispatched"))
    ).rejects.toThrow(ValidationError);
  });

  it("calls supabase.update on a valid transition", async () => {
    const dispatchedRow = {
      ref: "EVX-LIVE", customer_name: "X", flight: null,
      airport: "A", destination: "B", pickup_time: null,
      drivers: null, price: null, status: "Dispatched",
      priority: false, updated_at: null,
    };
    primeRows([dispatchedRow], 2);

    const { result } = renderHook(() => useBookings());
    await act(async () => {});

    await act(async () => {
      await result.current.updateStatus("EVX-LIVE", "En Route");
    });

    expect(mockChain.update).toHaveBeenCalledWith({ status: "En Route" });
  });

  it("throws when Supabase returns an error during update", async () => {
    const dispatchedRow = {
      ref: "EVX-ERR", customer_name: "X", flight: null,
      airport: "A", destination: "B", pickup_time: null,
      drivers: null, price: null, status: "Dispatched",
      priority: false, updated_at: null,
    };
    primeRows([dispatchedRow], 2);
    mockChain.eq.mockResolvedValueOnce({ data: [], error: { message: "DB write error" } });

    const { result } = renderHook(() => useBookings());
    await act(async () => {});

    await expect(
      act(() => result.current.updateStatus("EVX-ERR", "En Route"))
    ).rejects.toThrow(/DB write error/);
  });
});
