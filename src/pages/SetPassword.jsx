import React, { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

/**
 * Shown when Supabase reports a PASSWORD_RECOVERY auth event -- fired both
 * when someone follows a "forgot password" email and when someone follows
 * an invite email (an invite establishes a session the same way a recovery
 * link does, but they've never set a password of their own yet). Blocks
 * the rest of the app until they do.
 */
export default function SetPassword() {
  const { completePasswordRecovery } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await completePasswordRecovery(password);
    } catch (err) {
      setError(err.message || "Could not set password");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B132B] px-4 text-white">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/10">
            <Lock className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Set your password</h1>
            <p className="text-xs text-slate-500">This is your first sign-in, or a reset you requested.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-slate-500">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/40"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-[0.15em] text-slate-500">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-400/40"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 py-2.5 text-sm font-semibold text-[#0B132B] transition hover:bg-amber-300 disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Set password &amp; continue
          </button>
        </form>
      </div>
    </div>
  );
}
