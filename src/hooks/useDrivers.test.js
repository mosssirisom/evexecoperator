import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockChain, mockSupabase } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    order:  vi.fn(),
    eq:     vi.fn(),
    gte:    vi.fn(),
    lt:     vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
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
  supabase: mockSupabase,
  isConfigured: true,
}));

import { useDrivers, generateDriverPassword } from "./useDrivers";

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mockChain).forEach((fn) => fn.mockReturnValue(mockChain));
  // Persistent defaults for the two terminal calls in fetchDrivers:
  // .from("drivers").select("*").order("name")               -> order
  // .from("bookings").select(...).eq(...).gte(...).lt(...)   -> lt
  mockChain.order.mockResolvedValue({ data: [], error: null });
  mockChain.lt.mockResolvedValue({ data: [], error: null });
  mockChain.insert.mockResolvedValue({ error: null });
});

// ─── generateDriverPassword — pure function ──────────────────────────────────

describe("generateDriverPassword", () => {
  it("generates a 10-character password by default", () => {
    expect(generateDriverPassword()).toHaveLength(10);
  });

  it("generates a password of the requested length", () => {
    expect(generateDriverPassword(16)).toHaveLength(16);
  });

  it("only uses visually unambiguous characters", () => {
    const password = generateDriverPassword(200);
    expect(password).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789]+$/);
    expect(password).not.toMatch(/[0O1lI]/);
  });

  it("generates different passwords across calls", () => {
    expect(generateDriverPassword()).not.toBe(generateDriverPassword());
  });
});

// ─── fetchDrivers — shaping ───────────────────────────────────────────────────

describe("useDrivers — fetch", () => {
  it("shapes driver rows and merges today's completed-job counts", async () => {
    mockChain.order.mockResolvedValueOnce({
      data: [{
        id: "d1", name: "Nitisat Siri", status: "Available",
        vehicle: null, plate: null, phone: null, email: null, rating: null,
      }],
      error: null,
    });
    mockChain.lt.mockResolvedValueOnce({
      data: [{ driver_id: "d1" }, { driver_id: "d1" }, { driver_id: "d2" }],
    });

    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    expect(result.current.drivers).toHaveLength(1);
    expect(result.current.drivers[0]).toMatchObject({
      id: "d1",
      name: "Nitisat Siri",
      status: "Available",
      job: "No active job",
      vehicle: "—",
      plate: "—",
      phone: "—",
      email: null,
      completedToday: 2,
      rating: 5.0,
    });
  });

  it("sets an error message when the drivers query fails", async () => {
    mockChain.order.mockResolvedValueOnce({ data: null, error: { message: "DB read error" } });

    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    expect(result.current.error).toBe("DB read error");
    expect(result.current.drivers).toEqual([]);
  });
});

// ─── updateStatus ─────────────────────────────────────────────────────────────

describe("useDrivers — updateStatus", () => {
  it("calls supabase.update and refetches on success", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    await act(async () => {
      await result.current.updateStatus("d1", "On Job");
    });

    expect(mockChain.update).toHaveBeenCalledWith({ status: "On Job" });
    expect(mockChain.eq).toHaveBeenCalledWith("id", "d1");
  });

  it("throws when Supabase returns an error", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    mockChain.eq.mockResolvedValueOnce({ error: { message: "DB write error" } });

    await expect(
      act(() => result.current.updateStatus("d1", "On Job"))
    ).rejects.toThrow(/DB write error/);
  });
});

// ─── createDriver ─────────────────────────────────────────────────────────────

describe("useDrivers — createDriver", () => {
  it("throws ValidationError-style errors for missing/invalid fields", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    await expect(act(() => result.current.createDriver({ name: "" })))
      .rejects.toThrow(/name is required/i);

    await expect(act(() => result.current.createDriver({ name: "x".repeat(121) })))
      .rejects.toThrow(/120 characters/);

    await expect(act(() => result.current.createDriver({ name: "Valid Name", phone: "abc" })))
      .rejects.toThrow(/valid phone number/i);

    await expect(act(() => result.current.createDriver({ name: "Valid Name", plate: "X".repeat(21) })))
      .rejects.toThrow(/20 characters/);
  });

  it("inserts a driver with a generated password and returns it", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    let response;
    await act(async () => {
      response = await result.current.createDriver({
        name: "New Driver",
        phone: "+44 7700 900111",
        email: "new@example.com",
        vehicle: "Tesla Model 3",
        plate: "AB12 CDE",
      });
    });

    expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
      name: "New Driver",
      phone: "+44 7700 900111",
      email: "new@example.com",
      vehicle: "Tesla Model 3",
      plate: "AB12 CDE",
      status: "Available",
      rating: 5.0,
      password: expect.any(String),
    }));
    expect(response.password).toHaveLength(10);
  });

  it("throws when Supabase insert fails", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    mockChain.insert.mockResolvedValueOnce({ error: { message: "insert failed" } });

    await expect(
      act(() => result.current.createDriver({ name: "New Driver" }))
    ).rejects.toThrow(/insert failed/);
  });
});

// ─── updateDriver ─────────────────────────────────────────────────────────────

describe("useDrivers — updateDriver", () => {
  it("throws ValidationError-style errors for missing/invalid fields", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    await expect(act(() => result.current.updateDriver("d1", { name: "" })))
      .rejects.toThrow(/name is required/i);

    await expect(act(() => result.current.updateDriver("d1", { name: "Valid Name", phone: "abc" })))
      .rejects.toThrow(/valid phone number/i);
  });

  it("calls supabase.update with trimmed fields and null fallbacks", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    await act(async () => {
      await result.current.updateDriver("d1", {
        name: "  Updated Name  ", phone: "", email: "", vehicle: "", plate: "",
      });
    });

    expect(mockChain.update).toHaveBeenCalledWith({
      name: "Updated Name", phone: null, email: null, vehicle: null, plate: null,
    });
    expect(mockChain.eq).toHaveBeenCalledWith("id", "d1");
  });

  it("throws when Supabase returns an error", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    mockChain.eq.mockResolvedValueOnce({ error: { message: "update failed" } });

    await expect(
      act(() => result.current.updateDriver("d1", { name: "Valid Name" }))
    ).rejects.toThrow(/update failed/);
  });
});

// ─── deleteDriver ─────────────────────────────────────────────────────────────

describe("useDrivers — deleteDriver", () => {
  it("calls supabase.delete and refetches on success", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    await act(async () => {
      await result.current.deleteDriver("d1");
    });

    expect(mockChain.delete).toHaveBeenCalled();
    expect(mockChain.eq).toHaveBeenCalledWith("id", "d1");
  });

  it("throws when Supabase returns an error", async () => {
    const { result } = renderHook(() => useDrivers());
    await act(async () => {});

    mockChain.eq.mockResolvedValueOnce({ error: { message: "delete failed" } });

    await expect(
      act(() => result.current.deleteDriver("d1"))
    ).rejects.toThrow(/delete failed/);
  });
});
