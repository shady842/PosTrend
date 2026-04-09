"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type PublicPlan = {
  id: string;
  code: string;
  name: string;
  trialDays: number;
  priceMonthly: number | string;
  priceYearly: number | string;
  maxBranches: number;
  maxDevices: number;
  maxUsers: number;
  maxItems: number;
  isActive: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";

const comparisonRows = [
  { key: "pos", label: "POS" },
  { key: "inventory", label: "Inventory" },
  { key: "accounting", label: "Accounting" },
  { key: "hr", label: "HR" },
  { key: "ai", label: "AI" },
  { key: "api", label: "API access" }
] as const;

const comparisonByPlanCode: Record<string, Record<string, boolean>> = {
  starter: { pos: true, inventory: true, accounting: false, hr: false, ai: false, api: false },
  pro: { pos: true, inventory: true, accounting: true, hr: true, ai: true, api: true },
  enterprise: { pos: true, inventory: true, accounting: true, hr: true, ai: true, api: true }
};

function toNumber(value: number | string | undefined) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return `$${value.toFixed(0)}`;
}

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/public/plans`, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load plans (${res.status})`);
        const data = await res.json();
        setPlans(
          (Array.isArray(data) ? data : [])
            .filter((p) => p?.isActive !== false)
            .sort((a, b) => {
              const order = ["starter", "pro", "enterprise"];
              const ai = order.indexOf(String(a.code || "").toLowerCase());
              const bi = order.indexOf(String(b.code || "").toLowerCase());
              if (ai === -1 && bi === -1) return String(a.name).localeCompare(String(b.name));
              if (ai === -1) return 1;
              if (bi === -1) return -1;
              return ai - bi;
            })
        );
      } catch (e: any) {
        setError(e?.message || "Failed to load pricing plans");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const recommendedPlanId = useMemo(() => {
    const pro = plans.find((p) => String(p.code).toLowerCase() === "pro");
    return pro?.id || plans[1]?.id || "";
  }, [plans]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/50 via-white to-white">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold">
            <Image src="/brand/postrend-logo.svg" alt="PosTrend logo" width={28} height={28} />
            <span>PosTrend</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm hover:text-indigo-600">Login</Link>
            <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Start trial</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">Transparent pricing</p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 md:text-5xl">Simple pricing for every growth stage</h1>
          <p className="mt-4 text-slate-600">Choose Starter, Pro, or Enterprise and start with a free trial.</p>
          <div className="mt-6 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBillingCycle("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${billingCycle === "monthly" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle("yearly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${billingCycle === "yearly" ? "bg-indigo-600 text-white" : "text-slate-600"}`}
            >
              Yearly
            </button>
          </div>
        </div>

        {loading ? <p className="mt-8 text-center text-slate-500">Loading plans...</p> : null}
        {error ? <p className="mt-8 text-center text-rose-600">{error}</p> : null}

        {!loading && !error ? (
          <section className="mt-10 grid gap-5 md:grid-cols-3">
            {plans.map((plan, index) => {
              const isRecommended = plan.id === recommendedPlanId || String(plan.code).toLowerCase() === "pro";
              const price =
                billingCycle === "yearly"
                  ? toNumber(plan.priceYearly)
                  : toNumber(plan.priceMonthly);
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.25 }}
                  className={`relative rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${isRecommended ? "border-indigo-600 ring-2 ring-indigo-100" : "border-slate-200"}`}
                >
                  {isRecommended ? <p className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Recommended</p> : null}
                  {String(plan.code).toLowerCase() === "enterprise" ? <span className="absolute right-4 top-4 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">For scale</span> : null}
                  <h2 className="text-2xl font-bold">{plan.name}</h2>
                  <p className="mt-2 text-4xl font-extrabold text-slate-900">{money(price)}<span className="text-base font-medium text-slate-500">/{billingCycle === "yearly" ? "year" : "month"}</span></p>
                  <p className="mt-1 text-sm text-slate-500">{plan.trialDays} trial days</p>

                  <ul className="mt-5 space-y-2 text-sm text-slate-700">
                    <li className="flex items-center gap-2"><span className="text-indigo-600">✓</span>{plan.maxBranches} branches</li>
                    <li className="flex items-center gap-2"><span className="text-indigo-600">✓</span>{plan.maxDevices} devices</li>
                    <li className="flex items-center gap-2"><span className="text-indigo-600">✓</span>{plan.maxUsers} users</li>
                    <li className="flex items-center gap-2"><span className="text-indigo-600">✓</span>{plan.maxItems} items</li>
                  </ul>

                  <div className="mt-6 flex gap-2">
                    <Link href="/signup" className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-md shadow-indigo-200">
                      Start trial
                    </Link>
                    <a href="/#demo" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700">
                      Contact sales
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </section>
        ) : null}

        {!loading && !error && plans.length > 0 ? (
          <section className="mt-14">
            <h3 className="mb-4 text-2xl font-bold text-slate-900">Feature comparison</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Feature</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="px-4 py-3 text-center font-semibold text-slate-700">{plan.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.key} className="border-t border-slate-200">
                      <td className="px-4 py-3 font-medium text-slate-700">{row.label}</td>
                      {plans.map((plan) => {
                        const code = String(plan.code || "").toLowerCase();
                        const enabled = comparisonByPlanCode[code]?.[row.key] ?? true;
                        return (
                          <td key={`${plan.id}-${row.key}`} className="px-4 py-3 text-center text-lg">
                            {enabled ? "✓" : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}

