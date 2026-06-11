import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockAuth } = vi.hoisted(() => {
  const auth = {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
  };
  return { mockAuth: auth };
});

vi.mock("../lib/supabase", () => ({
  supabase: { auth: mockAuth },
  isConfigured: true,
}));

import { AuthProvider, useAuth } from "./AuthContext";

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

describe("AuthContext — configured mode", () => {
  it("starts loading and resolves to unauthenticated when there is no session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("becomes authenticated when a session is returned", async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { email: "operator@evexec.co.uk" } } },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user.email).toBe("operator@evexec.co.uk");
  });

  it("updates session when the auth state change listener fires", async () => {
    let authChangeCallback;
    mockAuth.onAuthStateChange.mockImplementation((cb) => {
      authChangeCallback = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      authChangeCallback("SIGNED_IN", { user: { email: "ops@evexec.co.uk" } });
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user.email).toBe("ops@evexec.co.uk");
  });

  it("signIn calls signInWithPassword and returns the session data", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { session: { user: { email: "operator@evexec.co.uk" } } },
      error: null,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signIn({ email: "operator@evexec.co.uk", password: "secret" });
    });

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "operator@evexec.co.uk",
      password: "secret",
    });
  });

  it("signIn throws when Supabase returns an error", async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: "Invalid login credentials" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.signIn({ email: "a@b.com", password: "wrong" }))
    ).rejects.toThrow(/Invalid login credentials/);
  });

  it("signOut calls supabase.auth.signOut", async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it("resetPassword calls resetPasswordForEmail and resolves on success", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resetPassword("operator@evexec.co.uk");
    });

    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith("operator@evexec.co.uk");
  });

  it("resetPassword throws when Supabase returns an error", async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: { message: "No user found" } });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(
      act(() => result.current.resetPassword("nobody@evexec.co.uk"))
    ).rejects.toThrow(/No user found/);
  });
});

describe("useAuth", () => {
  it("throws when used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/useAuth must be used within an AuthProvider/);
  });
});
