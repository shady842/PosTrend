import type { Metadata } from "next";
import { ComparePage } from "@/components/marketing/compare-page";

export const metadata: Metadata = {
  title: "PosTrend vs Toast",
  description: "Compare PosTrend vs Toast across flexibility, multi-branch control, and integrated business modules."
};

export default function CompareToastPage() {
  return (
    <ComparePage
      competitor="Toast"
      title="PosTrend vs Toast"
      subtitle="See how PosTrend compares for teams that need integrated operations beyond standalone POS."
      rows={[
        { feature: "Deployment flexibility", ours: "Designed for your own cloud stack", competitor: "More closed ecosystem" },
        { feature: "ERP-style modules", ours: "POS + inventory + accounting + HR", competitor: "Primarily POS-focused with integrations" },
        { feature: "Owner/tenant management", ours: "Native super-admin model", competitor: "Not built for your SaaS tenancy model" },
        { feature: "Customization", ours: "Adaptable workflows and UI", competitor: "More standardized platform constraints" }
      ]}
      why={[
        "One platform gives operators complete visibility across departments.",
        "Multi-tenant controls support growth from day one.",
        "You can customize experience and integrations to your business model."
      ]}
    />
  );
}

