import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

vi.mock("../lib/supabase", () => ({
  supabase: null,
  isConfigured: false,
}));

import { AuthProvider, useAuth } from "./AuthContext";

function wrapper({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthContext — demo mode (Supabase not configured)", () => {
  it("is authenticated immediately and skips the loading state", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.session).toBeNull();
  });

  it("signIn rejects because there is no database to authenticate against", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(
      result.current.signIn({ email: "a@b.com", password: "x" })
    ).rejects.toThrow(/Database not configured/);
  });

  it("resetPassword rejects because there is no database to authenticate against", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.resetPassword("a@b.com")).rejects.toThrow(/Database not configured/);
  });

  it("signOut resolves without error", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await expect(result.current.signOut()).resolves.toBeUndefined();
  });
});
