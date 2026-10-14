"use client";

import OperatorShell from "@/components/operator/Layout";
import { OperatorToastProvider } from "@/components/operator/Toast";
import { useAuth } from "@/hooks/useAuth";
import LoginScreen from "@/components/LoginScreen";

export default function OperatorLayout({ children }) {
  const { session, loading, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F3F6F9] flex items-center justify-center text-slate-600 text-sm gap-2">
        <span className="w-4 h-4 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
        Loading…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSignIn={signIn} />;
  }

  return (
    <OperatorToastProvider>
      <OperatorShell onSignOut={signOut}>{children}</OperatorShell>
    </OperatorToastProvider>
  );
}
