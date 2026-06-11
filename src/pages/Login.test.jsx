import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const { mockUseAuth, mockSignIn, mockResetPassword } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockSignIn: vi.fn(),
  mockResetPassword: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: mockUseAuth,
}));

import Login from "./Login";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  mockSignIn.mockReset();
  mockResetPassword.mockReset();
  mockUseAuth.mockReturnValue({
    isAuthenticated: false,
    loading: false,
    signIn: mockSignIn,
    resetPassword: mockResetPassword,
  });
});

describe("Login", () => {
  it("redirects to the dashboard when already authenticated", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      signIn: mockSignIn,
      resetPassword: mockResetPassword,
    });

    renderLogin();

    expect(screen.getByText("Dashboard")).toBeTruthy();
  });

  it("renders the sign-in form when not authenticated", () => {
    renderLogin();

    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
  });

  it("submits trimmed credentials to signIn", async () => {
    mockSignIn.mockResolvedValue();

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  ops@evexec.co.uk  " } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "hunter2" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({ email: "ops@evexec.co.uk", password: "hunter2" })
    );
  });

  it("shows an error message when signIn fails", async () => {
    mockSignIn.mockRejectedValue(new Error("Invalid login credentials"));

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ops@evexec.co.uk" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid login credentials")).toBeTruthy();
  });

  it("prompts for an email before requesting a password reset", () => {
    renderLogin();

    fireEvent.click(screen.getByText("Forgot password?"));

    expect(screen.getByText(/enter your email above/i)).toBeTruthy();
    expect(mockResetPassword).not.toHaveBeenCalled();
  });

  it("sends a reset email and shows a confirmation message", async () => {
    mockResetPassword.mockResolvedValue();

    renderLogin();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ops@evexec.co.uk" } });
    fireEvent.click(screen.getByText("Forgot password?"));

    expect(await screen.findByText(/password reset email sent/i)).toBeTruthy();
    expect(mockResetPassword).toHaveBeenCalledWith("ops@evexec.co.uk");
  });
});
