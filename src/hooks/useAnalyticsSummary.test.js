import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockSupabase } = vi.hoisted(() => {
  const client = { rpc: vi.fn() };
  return { mockSupabase: client };
});

vi.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
  isConfigured: true,
}));

vi.mock("./useRealtimeBookings", () => ({
  useRealtimeBookings: vi.fn(),
}));

import { useAnalyticsSummary } from "./useAnalyticsSummary";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAnalyticsSummary", () => {
  it("fetches and shapes totals and status breakdown on mount", async () => {
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === "get_booking_totals") {
        return Promise.resolve({
          data: [
            {
              total_bookings: 120,
              completed_bookings: 100,
              cancelled_bookings: 10,
              total_revenue: 4500.5,
              unique_customers: 75,
            },
          ],
          error: null,
        });
      }
      if (fn === "get_booking_status_breakdown") {
        return Promise.resolve({
          data: [
            { status: "Completed", count: 100 },
            { status: "Cancelled", count: 10 },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected RPC: ${fn}`);
    });

    const { result } = renderHook(() => useAnalyticsSummary());
    await act(async () => {});

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_booking_totals", { since: null });
    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_booking_status_breakdown", { since: null });

    expect(result.current.totals).toEqual({
      totalBookings: 120,
      completedBookings: 100,
      cancelledBookings: 10,
      totalRevenue: 4500.5,
      uniqueCustomers: 75,
    });
    expect(result.current.statusBreakdown).toEqual([
      { status: "Completed", count: 100 },
      { status: "Cancelled", count: 10 },
    ]);
    expect(result.current.error).toBeNull();
  });

  it("sets an error message when the totals query fails", async () => {
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === "get_booking_totals") {
        return Promise.resolve({ data: null, error: { message: "DB read error" } });
      }
      return Promise.resolve({ data: [], error: null });
    });

    const { result } = renderHook(() => useAnalyticsSummary());
    await act(async () => {});

    expect(result.current.error).toBe("DB read error");
    expect(result.current.totals).toBeNull();
  });

  it("sets an error message when the status breakdown query fails", async () => {
    mockSupabase.rpc.mockImplementation((fn) => {
      if (fn === "get_booking_totals") {
        return Promise.resolve({
          data: [
            {
              total_bookings: 1,
              completed_bookings: 1,
              cancelled_bookings: 0,
              total_revenue: 10,
              unique_customers: 1,
            },
          ],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: "DB read error" } });
    });

    const { result } = renderHook(() => useAnalyticsSummary());
    await act(async () => {});

    expect(result.current.error).toBe("DB read error");
    expect(result.current.statusBreakdown).toEqual([]);
  });
});
