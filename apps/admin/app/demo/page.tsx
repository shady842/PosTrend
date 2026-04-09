"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiPost } from "@/lib/api";

const businessTypes = ["Restaurant", "Cafe", "Cloud kitchen", "Bakery", "Other"];

export default function DemoRequestPage() {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL || "";
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    country: "",
    business_type: "Restaurant"
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name || !form.company || !form.email || !form.phone || !form.country || !form.business_type) {
      setError("Please fill all fields.");
      return;
    }
    setLoading(true);
    try {
      await apiPost("/public/demo-request", form, false);
      setSuccess(true);
      setForm({
        name: "",
        company: "",
        email: "",
        phone: "",
        country: "",
        business_type: "Restaurant"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit demo request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold">PosTrend</Link>
          <Link href="/pricing" className="text-sm hover:text-indigo-600">Pricing</Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-10 md:grid-cols-2 md:px-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">Book a Demo</h1>
          <p className="mt-2 text-slate-600">Tell us about your business and we will contact you to schedule a tailored walkthrough.</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Company</label>
              <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Country</label>
              <input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Business type</label>
              <select value={form.business_type} onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}>
                {businessTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
            {success ? (
              <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-emerald-600">
                Request submitted successfully. Our team will contact you soon.
              </motion.p>
            ) : null}
            <button disabled={loading} className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
              {loading ? "Submitting..." : "Send request"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-3 pt-3 text-lg font-semibold text-slate-900">Pick a time (optional)</h2>
          {calendlyUrl ? (
            <iframe title="Calendly" src={calendlyUrl} className="mt-3 h-[700px] w-full rounded-xl border border-slate-200" />
          ) : (
            <div className="m-3 rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
              Calendly embed is optional. Set `NEXT_PUBLIC_CALENDLY_URL` to show inline scheduling.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

