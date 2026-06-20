"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Mail, Lock } from "lucide-react";

interface Props {
  onSignIn: (email: string, password: string) => Promise<string | null>;
}

const inputCls =
  "w-full bg-navy-700 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-gold/40 transition-colors";

export default function LoginScreen({ onSignIn }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err = await onSignIn(email, password);
    if (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/logo.png"
            alt="EV Exec"
            width={180}
            height={180}
            priority
            className="object-contain"
          />
          <p
            className="text-slate-400 font-medium uppercase mt-2 tracking-widest"
            style={{ fontSize: "clamp(0.6rem, 1.5vw, 0.7rem)", letterSpacing: "0.22em" }}
          >
            Operator Portal
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/8 bg-navy-800 shadow-card p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <Mail size={11} className="text-gold/70" />
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="you@evexec.co.uk"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              <Lock size={11} className="text-gold/70" />
              Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gold-gradient text-navy-900 hover:opacity-90 active:scale-[0.98] disabled:opacity-60 transition-all"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-4">
          Restricted to authorised EV Exec staff
        </p>
      </div>
    </div>
  );
}