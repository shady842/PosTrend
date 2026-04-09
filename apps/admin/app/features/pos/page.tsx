import type { Metadata } from "next";
import { FeaturePage } from "@/components/marketing/feature-page";

export const metadata: Metadata = {
  title: "POS Features | PosTrend",
  description: "Explore PosTrend POS features for fast checkout, table service, and branch-wide sync."
};

export default function PosFeaturePage() {
  return (
    <FeaturePage
      label="POS"
      title="Speed up every order with a modern POS"
      subtitle="Built for quick service, dine-in workflows, and reliable offline-ready performance."
      bullets={[
        "Lightning-fast checkout with keyboard shortcuts",
        "Dine-in tables, split bills, and order modifiers",
        "Real-time sync across devices and branches",
        "Discounts, promos, and role-based cashier controls",
        "Day close summaries and cash drawer tracking"
      ]}
      ctaTitle="Launch your POS in minutes"
    />
  );
}

