import type { Metadata } from "next";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "POS for Cloud Kitchens | PosTrend",
  description: "Cloud kitchen POS for high-volume order orchestration, kitchen flow, and delivery-ready operations.",
  openGraph: {
    title: "POS for Cloud Kitchens | PosTrend",
    description: "Cloud kitchen POS for high-volume order orchestration, kitchen flow, and delivery-ready operations.",
    url: "http://localhost:3001/pos-for-cloud-kitchens",
    type: "website"
  }
};

export default function Page() {
  return (
    <SeoPage
      h1="POS for Cloud Kitchens"
      intro="Manage high-volume digital orders with a reliable POS and operational backbone tailored for cloud kitchens."
      schemaName="PosTrend Cloud Kitchen POS"
      schemaDescription="Cloud kitchen software for order flow, inventory, and centralized operations."
      sections={[
        {
          h2: "Handle high order volume without chaos",
          points: [
            "Consolidate and process orders with clear status tracking",
            "Kitchen-friendly workflows for preparation speed",
            "Reduce errors with standardized item and modifier logic"
          ]
        },
        {
          h2: "Scale across brands and locations",
          points: [
            "Monitor branch and concept performance in one dashboard",
            "Control costs with real-time inventory visibility",
            "Make decisions using live analytics and trend reports"
          ]
        }
      ]}
    />
  );
}

