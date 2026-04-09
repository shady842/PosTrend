"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/accounting", label: "Dashboard" },
  { href: "/accounting/chart-of-accounts", label: "Chart of Accounts" },
  { href: "/accounting/journal-entries", label: "Journal Entries" },
  { href: "/accounting/general-ledger", label: "General Ledger" },
  { href: "/accounting/profit-loss", label: "Profit & Loss" },
  { href: "/accounting/balance-sheet", label: "Balance Sheet" },
  { href: "/accounting/trial-balance", label: "Trial Balance" },
  { href: "/accounting/accounts-payable", label: "Accounts Payable" },
  { href: "/accounting/accounts-receivable", label: "Accounts Receivable" }
];

export default function AccountingLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => {
          const active = pathname === t.href || (t.href !== "/accounting" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition",
                active
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800/60"
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}

