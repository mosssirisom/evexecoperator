import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockChain, mockSupabase } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    eq:     vi.fn(),
    order:  vi.fn(),
    update: vi.fn(),
  };
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));

  const client = { from: vi.fn(() => chain) };

  return { mockChain: chain, mockSupabase: client };
});

vi.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
  isConfigured: true,
}));

import { useMissedCalls } from "./useMissedCalls";

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mockChain).forEach((fn) => {
    fn.mockReset();
    fn.mockReturnValue(mockChain);
  });
  mockChain.order.mockResolvedValue({ data: [], error: null });
});

// Prime the `order` mock (terminal call in fetchCalls) for the next N calls.
function primeOrder(rows, times = 1) {
  for (let i = 0; i < times; i++) {
    mockChain.order.mockResolvedValueOnce({ data: rows, error: null });
  }
}

describe("useMissedCalls — fetch", () => {
  it("fetches and shapes missed calls on mount", async () => {
    primeOrder([
      {
        ref: "MC-1",
        caller: "+44 7700 900111",
        created_at: "2025-07-01T10:00:00.000Z",
        attempts: 2,
        notes: null,
        resolved: false,
      },
    ]);

    const { result } = renderHook(() => useMissedCalls());
    await act(async () => {});

    expect(mockSupabase.from).toHaveBeenCalledWith("missed_calls");
    expect(mockChain.eq).toHaveBeenCalledWith("resolved", false);
    expect(result.current.calls).toHaveLength(1);

    const call = result.current.calls[0];
    expect(call.id).toBe("MC-1");
    expect(call.caller).toBe("+44 7700 900111");
    expect(call.attempts).toBe(2);
    expect(call.notes).toBe("");
    expect(call.resolved).toBe(false);
  });

  it("sets an error message when the query fails", async () => {
    for (let i = 0; i < 2; i++) {
      mockChain.order.mockResolvedValueOnce({ data: null, error: { message: "DB read error" } });
    }

    const { result } = renderHook(() => useMissedCalls());
    await act(async () => {});

    expect(result.current.error).toBe("DB read error");
    expect(result.current.calls).toEqual([]);
  });
});

describe("useMissedCalls — resolve", () => {
  it("marks a call resolved and refetches", async () => {
    primeOrder([
      {
        ref: "MC-1", caller: "+44 1", created_at: "2025-07-01T10:00:00.000Z",
        attempts: 1, notes: "", resolved: false,
      },
    ]);

    const { result } = renderHook(() => useMissedCalls());
    await act(async () => {});

    primeOrder([], 1);
    await act(async () => {
      await result.current.resolve("MC-1");
    });

    expect(mockChain.update).toHaveBeenCalledWith({ resolved: true });
    expect(mockChain.eq).toHaveBeenCalledWith("ref", "MC-1");
    expect(result.current.calls).toEqual([]);
  });

  it("throws when Supabase returns an error during resolve", async () => {
    primeOrder([
      {
        ref: "MC-2", caller: "+44 2", created_at: "2025-07-01T10:00:00.000Z",
        attempts: 1, notes: "", resolved: false,
      },
    ]);

    const { result } = renderHook(() => useMissedCalls());
    await act(async () => {});

    mockChain.eq.mockResolvedValueOnce({ error: { message: "DB write error" } });

    await expect(
      act(() => result.current.resolve("MC-2"))
    ).rejects.toThrow(/DB write error/);
  });
});

describe("useMissedCalls — resolveAll", () => {
  it("marks all unresolved calls resolved and refetches", async () => {
    primeOrder([
      { ref: "MC-1", caller: "+44 1", created_at: "2025-07-01T10:00:00.000Z", attempts: 1, notes: "", resolved: false },
      { ref: "MC-2", caller: "+44 2", created_at: "2025-07-01T10:00:00.000Z", attempts: 1, notes: "", resolved: false },
    ]);

    const { result } = renderHook(() => useMissedCalls());
    await act(async () => {});

    primeOrder([], 1);
    await act(async () => {
      await result.current.resolveAll();
    });

    expect(mockChain.update).toHaveBeenCalledWith({ resolved: true });
    expect(mockChain.eq).toHaveBeenCalledWith("resolved", false);
    expect(result.current.calls).toEqual([]);
  });

  it("throws when Supabase returns an error during resolveAll", async () => {
    primeOrder([]);

    const { result } = renderHook(() => useMissedCalls());
    await act(async () => {});

    mockChain.eq.mockResolvedValueOnce({ error: { message: "DB write error" } });

    await expect(
      act(() => result.current.resolveAll())
    ).rejects.toThrow(/DB write error/);
  });
});
