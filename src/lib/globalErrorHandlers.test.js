import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));

vi.mock("./errorLog", () => ({
  logError: mockLogError,
}));

import { installGlobalErrorHandlers } from "./globalErrorHandlers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("installGlobalErrorHandlers", () => {
  it("logs uncaught errors from window 'error' events", () => {
    installGlobalErrorHandlers();

    const error = new Error("Boom");
    window.dispatchEvent(Object.assign(new Event("error"), { error, message: "Boom" }));

    expect(mockLogError).toHaveBeenCalledWith({
      message: "Boom",
      stack: error.stack,
      context: { type: "window.onerror" },
    });
  });

  it("falls back to the event message when there is no error object", () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(Object.assign(new Event("error"), { error: null, message: "Script error" }));

    expect(mockLogError).toHaveBeenCalledWith({
      message: "Script error",
      stack: null,
      context: { type: "window.onerror" },
    });
  });

  it("logs unhandled promise rejections with an Error reason", () => {
    installGlobalErrorHandlers();

    const reason = new Error("Rejected");
    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason }));

    expect(mockLogError).toHaveBeenCalledWith({
      message: "Rejected",
      stack: reason.stack,
      context: { type: "unhandledrejection" },
    });
  });

  it("logs unhandled promise rejections with a non-Error reason", () => {
    installGlobalErrorHandlers();

    window.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason: "string reason" }));

    expect(mockLogError).toHaveBeenCalledWith({
      message: "string reason",
      stack: null,
      context: { type: "unhandledrejection" },
    });
  });
});
