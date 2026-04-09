import type { Metadata } from "next";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "POS for Restaurants | PosTrend",
  description: "Restaurant POS software for faster service, table management, and multi-branch control.",
  openGraph: {
    title: "POS for Restaurants | PosTrend",
    description: "Restaurant POS software for faster service, table management, and multi-branch control.",
    url: "http://localhost:3001/pos-for-restaurants",
    type: "website"
  }
};

export default function Page() {
  return (
    <SeoPage
      h1="POS for Restaurants"
      intro="Run front-of-house and back-of-house operations from one modern platform built for restaurant speed."
      schemaName="PosTrend Restaurant POS"
      schemaDescription="Cloud POS software designed for restaurant operations, inventory, and analytics."
      sections={[
        {
          h2: "Built for busy restaurant operations",
          points: [
            "Fast order entry for dine-in, takeaway, and delivery",
            "Table layout and order routing for smooth service",
            "Role-based permissions for cashiers and managers"
          ]
        },
        {
          h2: "Improve control and profitability",
          points: [
            "Track top-selling items and peak-hour performance",
            "Reduce waste with integrated inventory tracking",
            "Get daily sales summaries and branch-level insights"
          ]
        }
      ]}
    />
  );
}

