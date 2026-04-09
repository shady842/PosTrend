import type { Metadata } from "next";
import { FeaturePage } from "@/components/marketing/feature-page";

export const metadata: Metadata = {
  title: "Accounting Features | PosTrend",
  description: "Manage journals, ledgers, and financial statements from one accounting workspace."
};

export default function AccountingFeaturePage() {
  return (
    <FeaturePage
      label="Accounting"
      title="Run accurate books with less manual effort"
      subtitle="Automate core accounting workflows and keep financial reporting audit-ready."
      bullets={[
        "Journal entries with approval-friendly workflows",
        "General ledger and chart of accounts management",
        "Accounts payable and receivable views",
        "Profit & loss, balance sheet, and trial balance reports",
        "Branch-aware accounting visibility"
      ]}
      ctaTitle="Make accounting operations easier"
    />
  );
}

