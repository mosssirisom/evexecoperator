import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isConfigured } from "../lib/supabase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn({ email, password }) {
    if (!isConfigured) throw new Error("Database not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  }

  async function signOut() {
    if (!isConfigured) return;
    await supabase.auth.signOut();
  }

  async function resetPassword(email) {
    if (!isConfigured) throw new Error("Database not configured.");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  }

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    // In demo mode (no Supabase configured) there's nothing to protect, so
    // skip the login screen entirely rather than blocking local development.
    isAuthenticated: !isConfigured || Boolean(session),
    signIn,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
