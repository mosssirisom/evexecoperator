import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

import ProtectedRoute from "./ProtectedRoute";

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<div>Protected Content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockUseAuth.mockReset();
});

describe("ProtectedRoute", () => {
  it("shows a loading indicator while auth state is resolving", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: true });

    const { container } = renderWithRouter();

    expect(screen.queryByText("Protected Content")).toBeNull();
    expect(screen.queryByText("Login Page")).toBeNull();
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("redirects to /login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false });

    renderWithRouter();

    expect(screen.getByText("Login Page")).toBeTruthy();
    expect(screen.queryByText("Protected Content")).toBeNull();
  });

  it("renders the protected content when authenticated", () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: true, loading: false });

    renderWithRouter();

    expect(screen.getByText("Protected Content")).toBeTruthy();
    expect(screen.queryByText("Login Page")).toBeNull();
  });
});
