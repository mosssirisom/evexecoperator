import React, { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Navigation, Loader2, Eye, EyeOff } from "lucide-react";
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
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl border border-amber-400/20 bg-amber-400/10">
            <Navigation className="h-6 w-6 text-amber-400" />
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-400">EV Exec</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Operator sign in</h1>
          <p className="mt-2 text-sm text-slate-500">Control room access only</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          {error && (
            <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}
          {info && (
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
              {info}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-amber-400/40 focus:bg-white/[0.05]"
              placeholder="you@evexec.co.uk"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 pr-11 text-sm text-white outline-none placeholder:text-slate-600 transition focus:border-amber-400/40 focus:bg-white/[0.05]"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Sign in
          </button>

          <button
            type="button"
            onClick={handleForgotPassword}
            className="w-full text-center text-xs text-slate-500 transition hover:text-amber-300"
          >
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}
