"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PortalLinks } from "@/components/portal-links";
import { apiPost } from "@/lib/api";
import { setSessionTokens } from "@/lib/auth";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiPost("/super-admin/auth/login", { email, password }, false);
      setSessionTokens(res.access_token, res.refresh_token);
      router.push("/super-admin/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-sky-100 dark:from-slate-950 dark:to-slate-900" />
      <form onSubmit={submit} className="glass card z-10 w-full max-w-md p-6">
        <h1 className="mb-1 text-2xl font-bold">Super Admin Login</h1>
        <p className="muted mb-6 text-sm">Platform owner panel access</p>
        <div className="mb-3">
          <label className="mb-1 block text-sm">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </div>
        <div className="mb-4">
          <label className="mb-1 block text-sm">Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        </div>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button disabled={loading} className="w-full bg-indigo-600 text-white">
          {loading ? "Signing in..." : "Login"}
        </button>
        <div className="mt-6 border-t border-slate-200/80 pt-4 dark:border-slate-700">
          <p className="muted mb-2 text-center text-xs">Other entry points</p>
          <PortalLinks />
        </div>
      </form>
    </div>
  );
}

