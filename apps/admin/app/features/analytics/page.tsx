import type { Metadata } from "next";
import { FeaturePage } from "@/components/marketing/feature-page";

export const metadata: Metadata = {
  title: "Analytics Features | PosTrend",
  description: "Track sales, operations, and growth metrics with PosTrend analytics and insights."
};

export default function AnalyticsFeaturePage() {
  return (
    <FeaturePage
      label="Analytics"
      title="Turn operational data into growth decisions"
      subtitle="Monitor the metrics that matter with real-time dashboards and actionable insights."
      bullets={[
        "Live sales dashboards and period comparisons",
        "Category, item, and branch performance breakdowns",
        "Order trends and peak-hour insights",
        "Revenue and cost visibility across locations",
        "Decision-ready reports for operators and owners"
      ]}
      ctaTitle="Scale faster with better insights"
    />
  );
}

