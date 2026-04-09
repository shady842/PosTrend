"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPost } from "@/lib/api";
import { setSessionTokens } from "@/lib/auth";
import { motion } from "framer-motion";

const steps = ["Company", "Account", "Location"];

const currencies = ["USD", "EUR", "GBP", "AED", "SAR", "LBP"];

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [tenantName, setTenantName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validateCurrentStep() {
    if (step === 1) {
      if (!tenantName.trim()) return "Company name is required";
      return "";
    }
    if (step === 2) {
      if (!ownerName.trim()) return "Name is required";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Valid email is required";
      if (password.length < 6) return "Password must be at least 6 characters";
      return "";
    }
    if (!country.trim()) return "Country is required";
    if (!currency.trim()) return "Currency is required";
    return "";
  }

  const onNext = () => {
    const msg = validateCurrentStep();
    setError(msg);
    if (msg) return;
    setStep((s) => Math.min(3, s + 1));
  };

  const onBack = () => {
    setError("");
    setStep((s) => Math.max(1, s - 1));
  };

  const submit = async () => {
    const msg = validateCurrentStep();
    setError(msg);
    if (msg) return;
    setError("");
    setLoading(true);
    try {
      const res = await apiPost(
        "/public/signup",
        {
          tenant_name: tenantName,
          owner_name: ownerName,
          email,
          password,
          country,
          currency
        },
        false
      );
      setSessionTokens(res.access_token, res.refresh_token);
      setSuccess(true);
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
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
        onSubmit={(e) => {
          e.preventDefault();
          if (step < 3) onNext();
          else void submit();
        }}
        className="glass card z-10 w-full max-w-md p-6"
      >
        <h1 className="mb-1 text-2xl font-bold">Start Your Free Trial</h1>
        <p className="muted mb-4 text-sm">Create tenant, assign trial, and get your default branch ready.</p>

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            {steps.map((label, i) => (
              <span key={label} className={i + 1 <= step ? "font-semibold text-indigo-600" : ""}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200">
            <motion.div
              className="h-2 rounded-full bg-indigo-600"
              initial={{ width: "33%" }}
              animate={{ width: `${(step / 3) * 100}%` }}
            />
          </div>
        </div>

        {step === 1 ? (
          <div className="mb-4">
            <label className="mb-1 block text-sm">Company name</label>
            <input value={tenantName} onChange={(e) => setTenantName(e.target.value)} required />
          </div>
        ) : null}

        {step === 2 ? (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm">Name</label>
              <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-sm">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div className="mb-3">
              <label className="mb-1 block text-sm">Country</label>
              <input value={country} onChange={(e) => setCountry(e.target.value)} required />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-sm">Currency</label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} required>
                {currencies.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

        {success ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-3 rounded-lg bg-emerald-50 p-3 text-center text-sm font-medium text-emerald-700"
          >
            Tenant created. Redirecting...
          </motion.div>
        ) : null}

        <div className="flex gap-2">
          <button type="button" onClick={onBack} disabled={step === 1 || loading} className="w-1/3 border border-slate-300">
            Back
          </button>
          <button disabled={loading || success} className="w-2/3 bg-indigo-600 text-white hover:bg-indigo-500">
            {loading ? "Creating..." : step < 3 ? "Next" : "Start trial"}
          </button>
        </div>

        <p className="muted mt-4 text-sm">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-600 underline">
            Login
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
