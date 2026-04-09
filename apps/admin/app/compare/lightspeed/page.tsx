import type { Metadata } from "next";
import { ComparePage } from "@/components/marketing/compare-page";

export const metadata: Metadata = {
  title: "PosTrend vs Lightspeed",
  description: "Compare PosTrend vs Lightspeed by feature depth, pricing transparency, and control."
};

export default function CompareLightspeedPage() {
  return (
    <ComparePage
      competitor="Lightspeed"
      title="PosTrend vs Lightspeed"
      subtitle="Evaluate which platform gives your team better operational control and growth readiness."
      rows={[
        { feature: "All-in-one operations", ours: "End-to-end POS + ops modules", competitor: "Often integration-heavy stack" },
        { feature: "Pricing simplicity", ours: "Transparent plan and trial flow", competitor: "Can vary by package/add-ons" },
        { feature: "SaaS owner controls", ours: "Dedicated super-admin panel", competitor: "Not centered on your owner workflows" },
        { feature: "Data and reporting", ours: "Cross-module analytics in one place", competitor: "Data spread across modules/tools" }
      ]}
      why={[
        "Integrated data model means less reconciliation work.",
        "Faster onboarding with trial-ready, self-serve flow.",
        "Better control for founders and operators scaling multi-branch businesses."
      ]}
    />
  );
}

