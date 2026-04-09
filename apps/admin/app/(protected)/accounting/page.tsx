"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { DollarSign, FileSpreadsheet, Landmark, PieChart } from "lucide-react";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { FinancialCard } from "@/components/accounting/financial-card";
import { ChartCard } from "@/components/chart-card";
import { useToast } from "@/components/toast";

type Coa = { id: string; code: string; name: string; type: string; parentId?: string | null };

const MiniCharts = dynamic(() => import("./ui/mini-charts"), { ssr: false });

export default function AccountingDashboardPage() {
  const { notify } = useToast();
  const [accounts, setAccounts] = useState<Coa[]>([]);
  const [taxLedger, setTaxLedger] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [coa, tax] = await Promise.all([apiGet("/accounting/chart-of-accounts"), apiGet("/accounting/tax-ledger")]);
        setAccounts(Array.isArray(coa) ? coa : []);
        setTaxLedger(Array.isArray(tax) ? tax : []);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Failed to load accounting");
      }
    })();
  }, [notify]);

  const stats = useMemo(() => {
    const totalCoa = accounts.length;
    const assets = accounts.filter((a) => String(a.type).toUpperCase() === "ASSET").length;
    const liabilities = accounts.filter((a) => String(a.type).toUpperCase() === "LIABILITY").length;
    const income = accounts.filter((a) => String(a.type).toUpperCase() === "INCOME").length;
    return { totalCoa, assets, liabilities, income };
  }, [accounts]);

  return (
    <div className="space-y-4">
      <PageHeader title="Accounting" description="Modern ERP accounting workspace: journals, ledgers, and financial reports." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FinancialCard title="Accounts" value={String(stats.totalCoa)} icon={<Landmark className="h-5 w-5 text-indigo-600" />} />
        <FinancialCard title="Assets (COA)" value={String(stats.assets)} icon={<FileSpreadsheet className="h-5 w-5 text-emerald-600" />} tone="neutral" />
        <FinancialCard title="Liabilities (COA)" value={String(stats.liabilities)} icon={<DollarSign className="h-5 w-5 text-amber-600" />} tone="neutral" />
        <FinancialCard title="Income (COA)" value={String(stats.income)} icon={<PieChart className="h-5 w-5 text-sky-600" />} tone="neutral" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Revenue trend" subtitle="Preview (wire to reports endpoints next)"><MiniCharts kind="revenue" /></ChartCard>
        <ChartCard title="Expense mix" subtitle="Preview"><MiniCharts kind="expense" /></ChartCard>
        <ChartCard title="P&L" subtitle="Preview"><MiniCharts kind="pnl" /></ChartCard>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold">Tax ledger (recent)</h3>
        <p className="muted mt-1 text-xs">Showing the latest tax postings for the selected branch in your session.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {taxLedger.slice(0, 6).map((t: any) => (
            <div key={t.id} className="rounded-xl border border-slate-200/60 bg-white p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t.taxCode}</span>
                <span className="font-mono text-xs tabular-nums">{Number(t.taxRate).toFixed(4)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="muted">{new Date(t.postedAt).toLocaleString()}</span>
                <span className="font-semibold tabular-nums">{Number(t.amount).toFixed(2)}</span>
              </div>
            </div>
          ))}
          {!taxLedger.length ? <p className="muted text-sm">No tax ledger rows yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

