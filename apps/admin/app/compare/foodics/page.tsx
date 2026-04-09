import type { Metadata } from "next";
import { ComparePage } from "@/components/marketing/compare-page";

export const metadata: Metadata = {
  title: "PosTrend vs Foodics",
  description: "Compare PosTrend vs Foodics on POS, inventory, analytics, and operational flexibility."
};

export default function CompareFoodicsPage() {
  return (
    <ComparePage
      competitor="Foodics"
      title="PosTrend vs Foodics"
      subtitle="A practical comparison for operators who need control, speed, and better multi-module workflows."
      rows={[
        { feature: "POS + Inventory + Accounting + HR", ours: "Unified in one platform", competitor: "Varies by setup and add-ons" },
        { feature: "Super admin / multi-tenant control", ours: "Built-in owner panel", competitor: "Not focused on SaaS owner ops" },
        { feature: "Trial onboarding", ours: "Self-serve tenant trial flow", competitor: "Depends on sales/onboarding process" },
        { feature: "Customization velocity", ours: "Fast iteration in your stack", competitor: "Platform constraints" }
      ]}
      why={[
        "Unified modules reduce switching and operational friction.",
        "Owner-level controls help you scale SaaS operations cleanly.",
        "Flexible architecture supports your roadmap and custom workflows."
      ]}
    />
  );
}

