import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { mockSupabase, channels } = vi.hoisted(() => {
  const channels = [];
  const makeChannel = () => {
    const channel = {
      on: vi.fn(function (_event, _filter, cb) {
        channel._handler = cb;
        return channel;
      }),
      subscribe: vi.fn(function (statusCb) {
        channel._statusCb = statusCb;
        return channel;
      }),
    };
    channels.push(channel);
    return channel;
  };

  const client = {
    channel: vi.fn(() => makeChannel()),
    removeChannel: vi.fn(),
  };

  return { mockSupabase: client, channels };
});

vi.mock("../lib/supabase", () => ({
  supabase: mockSupabase,
  isConfigured: true,
}));

import { useRealtimeBookings, useRealtimeDrivers, useRealtimeAuditLog } from "./useRealtimeBookings";

beforeEach(() => {
  channels.length = 0;
  mockSupabase.channel.mockClear();
  mockSupabase.removeChannel.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useRealtimeBookings", () => {
  it("subscribes to postgres_changes on the bookings table", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeBookings(onUpdate));

    expect(mockSupabase.channel).toHaveBeenCalledTimes(1);
    expect(mockSupabase.channel.mock.calls[0][0]).toMatch(/^bookings-realtime-/);

    const channel = channels[0];
    expect(channel.on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "bookings" },
      expect.any(Function)
    );
    expect(channel.subscribe).toHaveBeenCalled();
  });

  it("calls onUpdate when the channel reports a change", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeBookings(onUpdate));

    channels[0]._handler();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on unmount", () => {
    const onUpdate = vi.fn();
    const { unmount } = renderHook(() => useRealtimeBookings(onUpdate));
    const channel = channels[0];

    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("reconnects with a new channel after a CHANNEL_ERROR", () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeBookings(onUpdate));
    const firstChannel = channels[0];

    act(() => {
      firstChannel._statusCb("CHANNEL_ERROR");
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(firstChannel);
    expect(mockSupabase.channel).toHaveBeenCalledTimes(2);
  });
});

describe("useRealtimeDrivers", () => {
  it("subscribes to postgres_changes on the drivers table", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeDrivers(onUpdate));

    expect(mockSupabase.channel.mock.calls[0][0]).toMatch(/^drivers-realtime-/);
    expect(channels[0].on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "drivers" },
      expect.any(Function)
    );
  });
});

describe("useRealtimeAuditLog", () => {
  it("subscribes to postgres_changes on the audit_log table", () => {
    const onUpdate = vi.fn();
    renderHook(() => useRealtimeAuditLog(onUpdate));

    expect(mockSupabase.channel.mock.calls[0][0]).toMatch(/^audit_log-realtime-/);
    expect(channels[0].on).toHaveBeenCalledWith(
      "postgres_changes",
      { event: "*", schema: "public", table: "audit_log" },
      expect.any(Function)
    );
  });
});
