import type { Metadata } from "next";
import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "PosTrend | Modern POS SaaS",
  description:
    "Modern SaaS platform for POS, inventory, accounting, HR, and AI. Start free trial or book a demo.",
  keywords: [
    "POS",
    "Inventory",
    "Accounting",
    "HR",
    "Restaurant software",
    "Cloud kitchen",
    "Bakery POS",
    "SaaS"
  ]
};

export default function HomePage() {
  return <LandingPage />;
}
