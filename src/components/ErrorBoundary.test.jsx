import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));

vi.mock("../lib/errorLog", () => ({
  logError: mockLogError,
}));

function Bomb({ shouldThrow }) {
  if (shouldThrow) throw new Error("Boom");
  return <p>All good</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("ErrorBoundary", () => {
  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeTruthy();
  });

  it("renders a fallback and logs the error when a child throws", () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Boom",
        stack: expect.any(String),
        componentStack: expect.any(String),
      })
    );
  });

  it("allows retrying after an error", () => {
    let shouldThrow = true;
    function ToggleBomb() {
      return <Bomb shouldThrow={shouldThrow} />;
    }

    const { rerender } = render(
      <ErrorBoundary>
        <ToggleBomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeTruthy();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    rerender(
      <ErrorBoundary>
        <ToggleBomb />
      </ErrorBoundary>
    );

    expect(screen.getByText("All good")).toBeTruthy();
  });
});
