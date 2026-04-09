"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { ReportHeader } from "@/components/accounting/report-header";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };

export default function TrialBalancePage() {
  const { notify } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [totalDebit, setTotalDebit] = useState(0);
  const [totalCredit, setTotalCredit] = useState(0);

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
      const data = (await apiGet(`/accounting/trial-balance?${qs.toString()}`)) as any;
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      setTotalDebit(Number(data?.total_debit || 0));
      setTotalCredit(Number(data?.total_credit || 0));
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load trial balance");
    }
  }, [branchId, dateFrom, dateTo, notify]);

  useEffect(() => void load(), [load]);

  const balanced = useMemo(() => Math.abs(totalDebit - totalCredit) < 0.01, [totalDebit, totalCredit]);

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Trial Balance"
        subtitle="Dr/Cr totals must balance. Computed from posted journal lines."
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
            {rows.map((r) => (
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
        <div className="sticky bottom-0 border-t border-slate-200/60 bg-white p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className={balanced ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300"}>
              {balanced ? "Balanced" : "Not balanced"}
            </span>
            <div className="flex justify-end gap-6 font-mono tabular-nums">
              <span>Dr {Number(totalDebit).toFixed(2)}</span>
              <span>Cr {Number(totalCredit).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

