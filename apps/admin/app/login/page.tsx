"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { PortalLinks } from "@/components/portal-links";
import { apiPost } from "@/lib/api";
import { setSessionTokens } from "@/lib/auth";
import { motion } from "framer-motion";

const REMEMBER_EMAIL_KEY = "pt_remember_email";
const POST_LOGIN_URL = process.env.NEXT_PUBLIC_POST_LOGIN_URL || "http://app.yourdomain.com";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const remembered = localStorage.getItem(REMEMBER_EMAIL_KEY) || "";
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiPost("/auth/login", { email, password }, false);
      setSessionTokens(res.access_token, res.refresh_token, rememberMe);
      if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, email);
      else localStorage.removeItem(REMEMBER_EMAIL_KEY);

      const isDefaultTarget = POST_LOGIN_URL.includes("app.yourdomain.com");
      const isLocalhost = window.location.hostname.includes("localhost");
      if (isDefaultTarget && isLocalhost) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = POST_LOGIN_URL;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-sky-100 dark:from-slate-950 dark:to-slate-900" />
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="glass card z-10 w-full max-w-md p-6"
      >
        <h1 className="mb-1 text-2xl font-bold">Admin Login</h1>
        <p className="muted mb-6 text-sm">Sign in to your tenant dashboard</p>
        <div className="mb-3">
          <label className="mb-1 block text-sm">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm">Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        <div className="mb-4 flex items-center justify-between text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
            Remember me
          </label>
          <a href="mailto:support@postrend.local" className="text-indigo-600 underline">
            Forgot password?
          </a>
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
          {loading ? "Signing in..." : "Login"}
        </button>
        <p className="muted mt-4 text-sm">
          No account?{" "}
          <Link href="/signup" className="text-indigo-600 underline">
            Sign up
          </Link>
        </p>
        <div className="mt-6 border-t border-slate-200/80 pt-4 dark:border-slate-700">
          <p className="muted mb-2 text-center text-xs">Other entry points</p>
          <PortalLinks />
        </div>
      </motion.form>
    </div>
  );
}
