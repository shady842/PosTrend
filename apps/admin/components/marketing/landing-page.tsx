"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ConversionOptimizer } from "@/components/marketing/conversion-optimizer";
import { PortalLinks } from "@/components/portal-links";
import { trackEvent } from "@/lib/analytics";

const features = [
  { title: "POS", text: "Fast checkout with real-time sync across branches." },
  { title: "Inventory", text: "Track stock, wastage, and purchase flow in one place." },
  { title: "Accounting", text: "Automate journals, ledgers, and financial visibility." },
  { title: "HR", text: "Manage employees, attendance, shifts, and payroll operations." },
  { title: "AI", text: "Get smart insights for demand, pricing, and anomalies." }
];

const steps = [
  { title: "Set up your business", text: "Create your tenant, branches, and products in minutes." },
  { title: "Connect devices", text: "Add POS terminals and start synchronized operations." },
  { title: "Scale with insights", text: "Use analytics and automation to grow faster." }
];

const industries = ["Restaurant", "Cafe", "Cloud kitchen", "Bakery"];

const testimonials = [
  { quote: "We reduced order errors and improved service speed in one week.", name: "Aisha", company: "Urban Spoon Cafe" },
  { quote: "Inventory accuracy jumped immediately after moving to PosTrend.", name: "Rahul", company: "Crust Bakery" },
  { quote: "The reporting and accounting flow saved our managers hours daily.", name: "Mina", company: "Kitchen Hub" }
];

const screenshots = [
  { label: "Live POS Dashboard", src: "/marketing/screenshot-pos.svg" },
  { label: "Inventory Control Panel", src: "/marketing/screenshot-inventory.svg" },
  { label: "Accounting Overview", src: "/marketing/screenshot-accounting.svg" },
  { label: "HR Workforce Screen", src: "/marketing/screenshot-hr.svg" }
];

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-slate-600">{subtitle}</p> : null}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-indigo-50/30 to-white text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 md:px-6">
          <div className="flex h-14 items-center justify-between md:h-16">
            <Link href="/" className="flex items-center gap-2 text-lg font-bold">
              <Image src="/brand/postrend-logo.svg" alt="PosTrend logo" width={28} height={28} />
              <span>PosTrend</span>
            </Link>
            <nav className="hidden flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm md:flex">
              <a href="#features" className="hover:text-indigo-600">
                Features
              </a>
              <Link href="/pricing" className="hover:text-indigo-600">
                Pricing
              </Link>
              <Link href="/demo" className="hover:text-indigo-600">
                Demo
              </Link>
              <PortalLinks tone="marketing" className="border-l border-slate-200 pl-5 dark:border-slate-700" />
              <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500">
                Start trial
              </Link>
            </nav>
            <Link
              href="/signup"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 md:hidden"
            >
              Trial
            </Link>
          </div>
          <div className="flex justify-center border-t border-slate-100 py-2 md:hidden dark:border-slate-800">
            <PortalLinks tone="marketing" />
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-7xl px-4 pb-20 pt-16 md:px-6 md:pt-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="grid items-center gap-8 lg:grid-cols-2"
          >
            <div className="text-center lg:text-left">
              <p className="mb-4 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
                Modern SaaS POS Platform
              </p>
              <h1 className="text-4xl font-extrabold tracking-tight md:text-6xl">
                Run your business with one powerful operating system
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-slate-600">
                PosTrend unifies POS, inventory, accounting, HR, and AI tools to help restaurants and food businesses grow with confidence.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href="/signup" onClick={() => trackEvent("hero_start_trial_click", { page: "home" })} className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-500">
                  Start Free Trial
                </Link>
                <a href="#demo" onClick={() => trackEvent("hero_book_demo_click", { page: "home" })} className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold hover:bg-slate-50">
                  Book Demo
                </a>
              </div>
              <div className="mt-6 grid max-w-md grid-cols-3 gap-3 text-left text-xs">
                <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="font-bold text-indigo-600">99.9%</p><p className="text-slate-500">Uptime</p></div>
                <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="font-bold text-indigo-600">30%</p><p className="text-slate-500">Faster ops</p></div>
                <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="font-bold text-indigo-600">24/7</p><p className="text-slate-500">Visibility</p></div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -left-6 -top-6 h-24 w-24 rounded-full bg-indigo-200/60 blur-2xl" />
              <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-sky-200/70 blur-2xl" />
              <div className="relative rounded-2xl border border-indigo-100 bg-white p-5 shadow-xl shadow-indigo-100/60">
                <p className="text-sm font-semibold text-slate-700">Today Overview</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Orders</p><p className="text-2xl font-bold">1,284</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Revenue</p><p className="text-2xl font-bold">$12.4k</p></div>
                  <div className="col-span-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white">
                    <p className="text-xs text-indigo-100">Growth this month</p>
                    <p className="text-3xl font-extrabold">+18.6%</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="h-2 rounded bg-slate-100"><div className="h-2 w-3/4 rounded bg-indigo-500" /></div>
                  <div className="h-2 rounded bg-slate-100"><div className="h-2 w-2/3 rounded bg-violet-500" /></div>
                  <div className="h-2 rounded bg-slate-100"><div className="h-2 w-4/5 rounded bg-sky-500" /></div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-6 md:px-6">
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
            <div><p className="text-3xl font-extrabold text-indigo-600">500+</p><p className="text-sm text-slate-500">Active business locations</p></div>
            <div><p className="text-3xl font-extrabold text-indigo-600">12M+</p><p className="text-sm text-slate-500">Orders processed annually</p></div>
            <div><p className="text-3xl font-extrabold text-indigo-600">35%</p><p className="text-sm text-slate-500">Average reporting speed gain</p></div>
            <div><p className="text-3xl font-extrabold text-indigo-600">4.9/5</p><p className="text-sm text-slate-500">Operator satisfaction score</p></div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <SectionTitle title="Everything your operations need" subtitle="Built for speed, scale, and control." />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {features.map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.35 }}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <SectionTitle title="Product screenshots" subtitle="A quick look at the platform experience." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {screenshots.map((item) => (
                <div key={item.label} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                  <div className="relative aspect-[16/10]">
                    <Image src={item.src} alt={item.label} fill className="object-cover" />
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-slate-700">{item.label}</p>
                  </div>
                </div>
              ))}
              </div>
            </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <SectionTitle title="How it works" subtitle="Go live in three simple steps." />
          <div className="grid gap-4 md:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title} className="rounded-xl border border-slate-200 p-5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <SectionTitle title="Built for your industry" />
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              {industries.map((industry) => (
                <div key={industry} className="rounded-xl border border-slate-200 bg-white p-4 text-center font-medium">
                  {industry}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <SectionTitle title="Loved by operators" />
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <blockquote key={t.name} className="rounded-xl border border-slate-200 p-5">
                <p className="text-slate-700">"{t.quote}"</p>
                <footer className="mt-3 text-sm text-slate-500">
                  {t.name} - {t.company}
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        <section id="pricing" className="bg-indigo-600 py-16 text-white">
          <div className="mx-auto max-w-4xl px-4 text-center md:px-6">
            <h2 className="text-3xl font-bold">Simple pricing, built to scale</h2>
            <p className="mt-3 text-indigo-100">Start with a free trial and upgrade when your business grows.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className="rounded-lg bg-white px-5 py-3 font-semibold text-indigo-700">
                Start Free Trial
              </Link>
              <a href="#demo" className="rounded-lg border border-indigo-300 px-5 py-3 font-semibold text-white">
                Book Demo
              </a>
            </div>
          </div>
        </section>
      </main>
      <ConversionOptimizer />

      <footer id="demo" className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 md:flex-row md:items-center md:justify-between md:px-6">
          <p>© {new Date().getFullYear()} PosTrend. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/login" className="hover:text-indigo-600">Login</Link>
            <Link href="/pricing" className="hover:text-indigo-600">Pricing</Link>
            <a href="#" className="hover:text-indigo-600">Docs</a>
            <a href="#" className="hover:text-indigo-600">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
