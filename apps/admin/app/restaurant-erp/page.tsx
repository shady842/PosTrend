import type { Metadata } from "next";
import { SeoPage } from "@/components/marketing/seo-page";

export const metadata: Metadata = {
  title: "Restaurant ERP Software | PosTrend",
  description: "Restaurant ERP software combining POS, inventory, accounting, HR, and analytics in one platform.",
  openGraph: {
    title: "Restaurant ERP Software | PosTrend",
    description: "Restaurant ERP software combining POS, inventory, accounting, HR, and analytics in one platform.",
    url: "http://localhost:3001/restaurant-erp",
    type: "website"
  }
};

export default function Page() {
  return (
    <SeoPage
      h1="Restaurant ERP Software"
      intro="Unify restaurant operations with an ERP platform that connects every team, workflow, and metric."
      schemaName="PosTrend Restaurant ERP"
      schemaDescription="Restaurant ERP platform connecting POS, inventory, accounting, HR, and analytics."
      sections={[
        {
          h2: "One connected platform for every department",
          points: [
            "POS and order operations synced with inventory",
            "Accounting and reporting integrated with daily sales",
            "HR and workforce data aligned with branch activity"
          ]
        },
        {
          h2: "Operate with confidence at scale",
          points: [
            "Centralized controls for multi-branch businesses",
            "Standardized processes across teams",
            "Real-time dashboards for leadership decisions"
          ]
        }
      ]}
    />
  );
}

