"use client";

import Link from "next/link";
import { motion } from "framer-motion";

type FeaturePageProps = {
  label: string;
  title: string;
  subtitle: string;
  bullets: string[];
  ctaTitle: string;
};

export function FeaturePage({ label, title, subtitle, bullets, ctaTitle }: FeaturePageProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold">PosTrend</Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm hover:text-indigo-600">Pricing</Link>
            <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Start trial</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <section className="mx-auto max-w-3xl text-center">
          <p className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            {label}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
          <p className="mt-4 text-slate-600">{subtitle}</p>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-6">
            <h2 className="text-xl font-bold">What you get</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-2 w-2 rounded-full bg-indigo-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-6"
          >
            <h2 className="text-xl font-bold">Screenshots</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-28 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 h-2 w-2/3 rounded bg-slate-200" />
                  <div className="mb-2 h-2 w-full rounded bg-slate-100" />
                  <div className="h-2 w-4/5 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </motion.div>
        </section>

        <section className="mt-10 rounded-2xl bg-indigo-600 px-6 py-10 text-center text-white">
          <h3 className="text-2xl font-bold">{ctaTitle}</h3>
          <p className="mt-2 text-indigo-100">Start your free trial or talk to our team for a tailored demo.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="rounded-lg bg-white px-5 py-3 font-semibold text-indigo-700">Start trial</Link>
            <a href="/#demo" className="rounded-lg border border-indigo-300 px-5 py-3 font-semibold text-white">Book demo</a>
          </div>
        </section>
      </main>
    </div>
  );
}

