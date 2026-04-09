import type { Metadata } from "next";
import { FeaturePage } from "@/components/marketing/feature-page";

export const metadata: Metadata = {
  title: "Inventory Features | PosTrend",
  description: "Track stock levels, wastage, transfers, and purchasing with PosTrend Inventory."
};

export default function InventoryFeaturePage() {
  return (
    <FeaturePage
      label="Inventory"
      title="Keep stock accurate and costs under control"
      subtitle="Prevent stockouts, reduce wastage, and automate inventory workflows across locations."
      bullets={[
        "Live stock levels per branch and item",
        "Purchase orders, receiving, and supplier workflows",
        "Wastage and adjustment tracking with reasons",
        "Low-stock alerts and reorder recommendations",
        "Batch and lot visibility for better traceability"
      ]}
      ctaTitle="Gain full inventory visibility"
    />
  );
}

