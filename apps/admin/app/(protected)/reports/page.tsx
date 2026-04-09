"use client";

import Link from "next/link";
import { PageHeader } from "@/components/page-header";

const pages = [
  { href: "/reports/sales", label: "Sales report" },
  { href: "/reports/items", label: "Items report" },
  { href: "/reports/category", label: "Category report" },
  { href: "/reports/branch-comparison", label: "Branch comparison" },
  { href: "/reports/cashier", label: "Cashier report" },
  { href: "/reports/inventory", label: "Inventory report" },
  { href: "/reports/discount", label: "Discount report" }
];

export default function ReportsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Reporting dashboard with filters, charts, pivot tables, and exports." />
      <div className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((p) => (
          <Link key={p.href} href={p.href} className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
