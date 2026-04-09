"use client";

type EventPayload = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export function trackEvent(name: string, params: EventPayload = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
  }
}

export function getAbVariant(testName: string) {
  if (typeof window === "undefined") return "A";
  const key = `pt_ab_${testName}`;
  const existing = localStorage.getItem(key);
  if (existing === "A" || existing === "B") return existing;
  const variant = Math.random() < 0.5 ? "A" : "B";
  localStorage.setItem(key, variant);
  return variant;
}

