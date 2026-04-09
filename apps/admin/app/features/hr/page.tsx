import type { Metadata } from "next";
import { FeaturePage } from "@/components/marketing/feature-page";

export const metadata: Metadata = {
  title: "HR Features | PosTrend",
  description: "Manage employees, attendance, shifts, and payroll with PosTrend HR tools."
};

export default function HrFeaturePage() {
  return (
    <FeaturePage
      label="HR"
      title="Manage your workforce from one dashboard"
      subtitle="Streamline HR operations from onboarding to attendance and payroll preparation."
      bullets={[
        "Employee records and department structure",
        "Attendance logs and shift scheduling",
        "Leave requests and approval workflows",
        "Payroll-ready data and reports",
        "Branch-level staffing visibility"
      ]}
      ctaTitle="Simplify HR operations"
    />
  );
}

