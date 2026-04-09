import type { Metadata } from "next";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "Restaurant Inventory Software | PosTrend",
  description: "Restaurant inventory software to track stock, reduce waste, and improve purchasing decisions.",
  openGraph: {
    title: "Restaurant Inventory Software | PosTrend",
    description: "Restaurant inventory software to track stock, reduce waste, and improve purchasing decisions.",
    url: "http://localhost:3001/restaurant-inventory-software",
    type: "website"
  }
};

export default function Page() {
  return (
    <SeoPage
      h1="Restaurant Inventory Software"
      intro="Gain complete stock visibility, reduce waste, and standardize inventory processes across branches."
      schemaName="PosTrend Restaurant Inventory Software"
      schemaDescription="Inventory software for restaurants with stock control, purchasing, and waste tracking."
      sections={[
        {
          h2: "Track inventory in real time",
          points: [
            "Live stock levels by branch and item",
            "Wastage logging with reasons and accountability",
            "Transfer and adjustment workflows for better control"
          ]
        },
        {
          h2: "Purchase smarter and avoid stockouts",
          points: [
            "Supplier and purchase order management",
            "Reorder recommendations for critical items",
            "Inventory reports for cost and usage analysis"
          ]
        }
      ]}
    />
  );
}

