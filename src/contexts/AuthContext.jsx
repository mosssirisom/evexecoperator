import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, isConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isConfigured);
  const [passwordRecoveryPending, setPasswordRecoveryPending] = useState(false);

  // tenantRoles: [{ tenantId, role }] for every tenant_users row belonging
  // to the current user (a person can hold more than one, e.g. operator_admin
  // *and* driver for the same tenant). super_admin rows have tenantId null.
  const [tenantRoles, setTenantRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const loadTenantRoles = useCallback(async (userId) => {
    if (!userId || !isConfigured) {
      setTenantRoles([]);
      return;
    }
    setRolesLoading(true);
    const { data, error } = await supabase
      .from("tenant_users")
      .select("tenant_id, role")
      .eq("user_id", userId);
    setRolesLoading(false);
    if (error) {
      console.error("Failed to load tenant roles:", error.message);
      setTenantRoles([]);
      return;
    }
    setTenantRoles((data || []).map((r) => ({ tenantId: r.tenant_id, role: r.role })));
  }, []);

  useEffect(() => {
    if (!isConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
      if (data.session?.user?.id) loadTenantRoles(data.session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") {
        // Fired both for "forgot password" links and invite-acceptance
        // links -- either way the user has a session now but hasn't set a
        // real password yet, so hold them on a set-password screen.
        setPasswordRecoveryPending(true);
      }
      if (newSession?.user?.id) {
        loadTenantRoles(newSession.user.id);
      } else {
        setTenantRoles([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadTenantRoles]);

  async function signIn({ email, password }) {
    if (!isConfigured) throw new Error("Database not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signOut() {
    if (!isConfigured) return;
    await supabase.auth.signOut();
    setTenantRoles([]);
  }

  async function resetPassword(email) {
    if (!isConfigured) throw new Error("Database not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }

  /** Completes a password-recovery / invite-acceptance flow. */
  async function completePasswordRecovery(newPassword) {
    if (!isConfigured) throw new Error("Database not configured.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    setPasswordRecoveryPending(false);
  }

  const isSuperAdmin = tenantRoles.some((r) => r.role === "super_admin");
  // The tenant a non-super-admin staff member operates under (first
  // non-driver role found; today everyone belongs to exactly one tenant).
  const staffRole = tenantRoles.find((r) => r.role === "operator_admin" || r.role === "dispatcher");

  const value = {
    session,
    user: session?.user ?? null,
    loading: loading || rolesLoading,
    // In demo mode (no Supabase configured) there's nothing to protect, so
    // skip the login screen entirely rather than blocking local development.
    isAuthenticated: !isConfigured || Boolean(session),
    signIn,
    signOut,
    resetPassword,
    tenantRoles,
    isSuperAdmin,
    tenantId: staffRole?.tenantId ?? null,
    role: staffRole?.role ?? (isSuperAdmin ? "super_admin" : null),
    passwordRecoveryPending,
    completePasswordRecovery,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
