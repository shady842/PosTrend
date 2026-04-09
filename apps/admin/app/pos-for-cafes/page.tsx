import type { Metadata } from "next";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "POS for Cafes | PosTrend",
  description: "Cafe POS software with quick billing, modifiers, loyalty support, and inventory control.",
  openGraph: {
    title: "POS for Cafes | PosTrend",
    description: "Cafe POS software with quick billing, modifiers, loyalty support, and inventory control.",
    url: "http://localhost:3001/pos-for-cafes",
    type: "website"
  }
};

export default function Page() {
  return (
    <SeoPage
      h1="POS for Cafes"
      intro="Serve more customers faster with a cafe-focused POS designed for high throughput and order accuracy."
      schemaName="PosTrend Cafe POS"
      schemaDescription="Cloud POS software for cafes with inventory and customer insights."
      sections={[
        {
          h2: "Speed up every transaction",
          points: [
            "One-tap billing with product modifiers and combos",
            "Quick re-orders for regular customers",
            "Flexible payment methods and discount controls"
          ]
        },
        {
          h2: "Keep inventory and margins healthy",
          points: [
            "Ingredient-level stock tracking for daily operations",
            "Low-stock alerts to avoid menu outages",
            "Sales-by-item reports to optimize menu performance"
          ]
        }
      ]}
    />
  );
}

