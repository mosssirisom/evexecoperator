import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import SetPassword from "../pages/SetPassword";

export default function ProtectedRoute() {
  const { isAuthenticated, loading, passwordRecoveryPending } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B132B]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // An invite-acceptance or password-reset link lands here with a session
  // already established but no real password set yet -- block everything
  // else until they set one.
  if (passwordRecoveryPending) {
    return <SetPassword />;
  }

  return <Outlet />;
}

/** Gate for routes that only a super_admin may see. */
export function SuperAdminRoute() {
  const { isSuperAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B132B]">
        <Loader2 className="h-6 w-6 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
