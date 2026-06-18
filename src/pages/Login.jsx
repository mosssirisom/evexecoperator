import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function Login() {
  const { isAuthenticated, loading, signIn, resetPassword } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  if (!loading && isAuthenticated) {
    const dest = location.state?.from?.pathname || "/";
    return <Navigate to={dest} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      await signIn({ email: email.trim(), password });
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email above, then click Forgot password.");
      return;
    }
    setError("");
    setInfo("");
    try {
      await resetPassword(email.trim());
      setInfo("Password reset email sent — check your inbox.");
    } catch (err) {
      setError(err.message || "Could not send reset email");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B132B] px-4 text-white">
      <div className="w-full max-w-md">
        {/* Logo placed above the main heading. Ensure the image has a transparent background. */}
        <div className="flex justify-center mb-4">
          <img
            src="/ev-exec-logo-circle.png"
            alt="EV Exec logo"
            className="h-20 w-20 object-contain bg-transparent"
          />
        </div>

        {/* Thin bordered container box with slight translucent background */}
        <div className="rounded-xl border border-white/20 bg-white/5 p-6">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-extrabold tracking-wide text-white">EV EXEC</h1>
            <p className="mt-1 text-xs text-slate-300">OPERATOR CALENDAR</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            {info && (
              <div className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-300">
                {info}
              </div>
            )}

            <div>
              <label htmlFor="login-email" className="sr-only">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-white/4 py-3 pr-4 pl-11 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-2xl border border-white/10 bg-white/4 py-3 pr-10 pl-11 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-600 disabled:opacity-60"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign in
            </button>

            <button
              type="button"
              onClick={handleForgotPassword}
              className="w-full text-center text-xs text-slate-400 hover:text-amber-300"
            >
              Forgot password?
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">Restricted to authorised EV Exec staff</p>
        </div>
      </div>
    </div>
  );
}
