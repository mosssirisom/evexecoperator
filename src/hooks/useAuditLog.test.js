import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockChain, mockSupabase } = vi.hoisted(() => {
  const chain = {
    select: vi.fn(),
    order:  vi.fn(),
    limit:  vi.fn(),
  };
  Object.values(chain).forEach((fn) => fn.mockReturnValue(chain));

  const client = { from: vi.fn(() => chain) };

  return { mockChain: chain, mockSupabase: client };
});

vi.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
  isConfigured: true,
}));

vi.mock("./useRealtimeBookings", () => ({
  useRealtimeAuditLog: vi.fn(),
}));

import { useAuditLog } from "./useAuditLog";

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mockChain).forEach((fn) => {
    fn.mockReset();
    fn.mockReturnValue(mockChain);
  });
  mockChain.limit.mockResolvedValue({ data: [], error: null });
});

describe("useAuditLog", () => {
  it("fetches and shapes audit log entries on mount", async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: [
        {
          id: "1",
          actor_email: "ops@evexec.co.uk",
          action: "booking.status_changed",
          entity_type: "booking",
          entity_id: "EVX-AB12",
          details: { from: "Dispatched", to: "Cancelled" },
          created_at: "2025-07-01T10:00:00.000Z",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useAuditLog());
    await act(async () => {});

    expect(mockSupabase.from).toHaveBeenCalledWith("audit_log");
    expect(mockChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockChain.limit).toHaveBeenCalledWith(50);
    expect(result.current.entries).toHaveLength(1);

    const entry = result.current.entries[0];
    expect(entry.actorEmail).toBe("ops@evexec.co.uk");
    expect(entry.action).toBe("booking.status_changed");
    expect(entry.entityType).toBe("booking");
    expect(entry.entityId).toBe("EVX-AB12");
    expect(entry.details).toEqual({ from: "Dispatched", to: "Cancelled" });
  });

  it("falls back to 'Unknown operator' when actor_email is missing", async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: [
        {
          id: "2",
          actor_email: null,
          action: "missed_call.resolved",
          entity_type: "missed_call",
          entity_id: "MC-001",
          details: null,
          created_at: "2025-07-01T10:00:00.000Z",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useAuditLog());
    await act(async () => {});

    expect(result.current.entries[0].actorEmail).toBe("Unknown operator");
  });

  it("sets an error message when the query fails", async () => {
    mockChain.limit.mockResolvedValueOnce({ data: null, error: { message: "DB read error" } });

    const { result } = renderHook(() => useAuditLog());
    await act(async () => {});

    expect(result.current.error).toBe("DB read error");
    expect(result.current.entries).toEqual([]);
  });
});
