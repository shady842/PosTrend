"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { ReportHeader } from "@/components/accounting/report-header";
import { FinancialCard } from "@/components/accounting/financial-card";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };

export default function ProfitLossPage() {
  const { notify } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setBranchId(localStorage.getItem("pt_branch_id") || "");
  }, []);

  const load = useCallback(async () => {
    try {
      const b = (await apiGet("/branches")) as Branch[];
      setBranches(Array.isArray(b) ? b : []);
      const qs = new URLSearchParams();
      if (branchId) qs.set("branch_id", branchId);
      if (dateFrom) qs.set("date_from", dateFrom);
      if (dateTo) qs.set("date_to", dateTo);
      const d = await apiGet(`/accounting/profit-loss?${qs.toString()}`);
      setData(d);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load P&L");
    }
  }, [branchId, dateFrom, dateTo, notify]);

  useEffect(() => void load(), [load]);

  const fmt = (n: number) => n.toFixed(2);
  const income = Number(data?.income || 0);
  const expenses = Number(data?.expenses || 0);
  const net = Number(data?.net_profit || 0);
  const tone = net >= 0 ? "good" : "bad";

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data]);

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Profit & Loss"
        subtitle="Computed from posted journal lines only."
        branchId={branchId}
        branches={branches}
        onBranchChange={(v) => {
          setBranchId(v);
          localStorage.setItem("pt_branch_id", v);
        }}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        right={
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-black" onClick={() => void load()}>
            Apply
          </button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <FinancialCard title="Income" value={fmt(income)} tone="good" />
        <FinancialCard title="Expenses" value={fmt(expenses)} tone="warn" />
        <FinancialCard title="Net profit" value={fmt(net)} tone={tone as any} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-900/40">
            <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
              <th className="p-3">Account</th>
              <th className="p-3">Type</th>
              <th className="p-3 text-right">Debit</th>
              <th className="p-3 text-right">Credit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.code} className="border-b border-slate-100 dark:border-slate-800/70">
                <td className="p-3 font-medium">
                  {r.code} — {r.name}
                </td>
                <td className="p-3 text-xs">{r.type}</td>
                <td className="p-3 text-right font-mono tabular-nums">{Number(r.debit || 0).toFixed(2)}</td>
                <td className="p-3 text-right font-mono tabular-nums">{Number(r.credit || 0).toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

