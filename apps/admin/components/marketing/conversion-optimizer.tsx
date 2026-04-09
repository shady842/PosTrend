"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiPost } from "@/lib/api";
import { getAbVariant, trackEvent } from "@/lib/analytics";

export function ConversionOptimizer() {
  const [showSticky, setShowSticky] = useState(false);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [email, setEmail] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [newsletterMsg, setNewsletterMsg] = useState("");
  const [leadMsg, setLeadMsg] = useState("");

  const variant = useMemo(() => getAbVariant("hero_cta_copy"), []);
  const ctaText = variant === "A" ? "Start Free Trial" : "Start My Free Trial";

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 180);
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 8 && !sessionStorage.getItem("pt_exit_popup_seen")) {
        setShowExitPopup(true);
        sessionStorage.setItem("pt_exit_popup_seen", "1");
        trackEvent("exit_intent_popup_shown", { variant });
      }
    };
    window.addEventListener("scroll", onScroll);
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [variant]);

  const submitLead = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setLeadMsg("");
    try {
      await apiPost("/public/leads/capture", { name, email, phone }, false);
      trackEvent("lead_capture_submit", { variant });
      setLeadMsg("Thanks! We will contact you soon.");
      setName("");
      setEmail("");
      setPhone("");
    } finally {
      setLoading(false);
    }
  };

  const submitNewsletter = async (e: FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    await apiPost("/public/newsletter/signup", { email: newsletterEmail, source: "website_footer" }, false);
    setNewsletterMsg("Subscribed successfully.");
    setNewsletterEmail("");
    trackEvent("newsletter_signup", { variant });
  };

  return (
    <>
      {showSticky ? (
        <div className="fixed top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-sm">
            <span>Ready to modernize your operations?</span>
            <Link
              href="/signup"
              className="rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white"
              onClick={() => trackEvent("sticky_header_cta_click", { variant })}
            >
              {ctaText}
            </Link>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="fixed bottom-5 right-5 z-40 rounded-full bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-500"
        onClick={() => {
          setShowLeadModal(true);
          trackEvent("floating_trial_button_click", { variant });
        }}
      >
        Start Trial
      </button>

      {(showLeadModal || showExitPopup) ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5">
            <h3 className="text-xl font-bold">Get started faster</h3>
            <p className="mt-1 text-sm text-slate-600">Leave your details and we will help you launch quickly.</p>
            <form className="mt-4 space-y-3" onSubmit={submitLead}>
              <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <input placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {leadMsg ? <p className="text-sm text-emerald-600">{leadMsg}</p> : null}
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="bg-indigo-600 text-white">{loading ? "Saving..." : "Submit"}</button>
                <button type="button" onClick={() => { setShowLeadModal(false); setShowExitPopup(false); }}>Close</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="mx-auto mt-10 max-w-6xl rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-lg font-semibold">Newsletter signup</h4>
        <p className="text-sm text-slate-600">Get product updates and growth tips.</p>
        <form className="mt-3 flex flex-wrap gap-2" onSubmit={submitNewsletter}>
          <input className="min-w-[240px] flex-1" placeholder="Enter email" type="email" value={newsletterEmail} onChange={(e) => setNewsletterEmail(e.target.value)} />
          <button type="submit" className="bg-indigo-600 text-white">Subscribe</button>
        </form>
        {newsletterMsg ? <p className="mt-2 text-sm text-emerald-600">{newsletterMsg}</p> : null}
      </div>
    </>
  );
}

