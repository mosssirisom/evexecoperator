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
  useRealtimeErrorLog: vi.fn(),
}));

import { useErrorLog } from "./useErrorLog";

beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mockChain).forEach((fn) => {
    fn.mockReset();
    fn.mockReturnValue(mockChain);
  });
  mockChain.limit.mockResolvedValue({ data: [], error: null });
});

describe("useErrorLog", () => {
  it("fetches and shapes error log entries on mount", async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: [
        {
          id: "1",
          message: "Cannot read properties of undefined",
          stack: "TypeError: Cannot read properties of undefined\n    at Foo",
          component_stack: "in Foo\n    in App",
          url: "https://app.evexec.co.uk/dispatch",
          user_email: "ops@evexec.co.uk",
          context: { page: "dispatch" },
          created_at: "2025-07-01T10:00:00.000Z",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useErrorLog());
    await act(async () => {});

    expect(mockSupabase.from).toHaveBeenCalledWith("error_log");
    expect(mockChain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockChain.limit).toHaveBeenCalledWith(50);
    expect(result.current.entries).toHaveLength(1);

    const entry = result.current.entries[0];
    expect(entry.message).toBe("Cannot read properties of undefined");
    expect(entry.stack).toContain("TypeError");
    expect(entry.componentStack).toBe("in Foo\n    in App");
    expect(entry.url).toBe("https://app.evexec.co.uk/dispatch");
    expect(entry.userEmail).toBe("ops@evexec.co.uk");
    expect(entry.context).toEqual({ page: "dispatch" });
  });

  it("falls back to 'Unknown operator' when user_email is missing", async () => {
    mockChain.limit.mockResolvedValueOnce({
      data: [
        {
          id: "2",
          message: "Boom",
          stack: null,
          component_stack: null,
          url: null,
          user_email: null,
          context: null,
          created_at: "2025-07-01T10:00:00.000Z",
        },
      ],
      error: null,
    });

    const { result } = renderHook(() => useErrorLog());
    await act(async () => {});

    expect(result.current.entries[0].userEmail).toBe("Unknown operator");
  });

  it("sets an error message when the query fails", async () => {
    mockChain.limit.mockResolvedValueOnce({ data: null, error: { message: "DB read error" } });

    const { result } = renderHook(() => useErrorLog());
    await act(async () => {});

    expect(result.current.error).toBe("DB read error");
    expect(result.current.entries).toEqual([]);
  });
});
