import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockChain, mockSupabase } = vi.hoisted(() => {
  const chain = { insert: vi.fn() };
  const client = {
    from: vi.fn(() => chain),
    auth: { getSession: vi.fn() },
  };
  return { mockChain: chain, mockSupabase: client };
});

vi.mock("./supabase", () => ({
  supabase: mockSupabase,
  isConfigured: true,
}));

import { logActivity } from "./auditLog";

beforeEach(() => {
  vi.clearAllMocks();
  mockChain.insert.mockResolvedValue({ error: null });
  mockSupabase.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: "user-1", email: "ops@evexec.co.uk" } } },
  });
});

describe("logActivity", () => {
  it("inserts an audit_log row with the current operator's identity", async () => {
    await logActivity({
      action: "booking.status_changed",
      entityType: "booking",
      entityId: "EVX-AB12",
      details: { from: "Dispatched", to: "Cancelled" },
    });

    expect(mockSupabase.from).toHaveBeenCalledWith("audit_log");
    expect(mockChain.insert).toHaveBeenCalledWith({
      actor_id: "user-1",
      actor_email: "ops@evexec.co.uk",
      action: "booking.status_changed",
      entity_type: "booking",
      entity_id: "EVX-AB12",
      details: { from: "Dispatched", to: "Cancelled" },
    });
  });

  it("stringifies non-string entity ids", async () => {
    await logActivity({ action: "driver.status_changed", entityType: "driver", entityId: 42 });

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ entity_id: "42" })
    );
  });

  it("records a null actor when there is no session", async () => {
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

    await logActivity({ action: "missed_call.resolved", entityType: "missed_call", entityId: "MC-001" });

    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null, actor_email: null })
    );
  });

  it("does not throw when the insert fails", async () => {
    mockChain.insert.mockResolvedValue({ error: { message: "DB write error" } });

    await expect(
      logActivity({ action: "booking.created", entityType: "booking", entityId: "EVX-AB12" })
    ).resolves.toBeUndefined();
  });

  it("does not throw when Supabase auth is unavailable", async () => {
    mockSupabase.auth.getSession.mockRejectedValue(new Error("network error"));

    await expect(
      logActivity({ action: "booking.created", entityType: "booking", entityId: "EVX-AB12" })
    ).resolves.toBeUndefined();
  });
});

describe("logActivity — not configured", () => {
  it("is a no-op when Supabase is not configured", async () => {
    vi.resetModules();
    vi.doMock("./supabase", () => ({ supabase: mockSupabase, isConfigured: false }));

    const { logActivity: logActivityDemo } = await import("./auditLog");
    await logActivityDemo({ action: "booking.created", entityType: "booking", entityId: "EVX-AB12" });

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
