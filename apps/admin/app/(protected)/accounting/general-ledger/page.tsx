"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { ReportHeader } from "@/components/accounting/report-header";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };
type Group = {
  account_code: string;
  name: string;
  type: string;
  debit: number;
  credit: number;
  rows: { id: string; date: string; entry_id: string; description: string; debit: number; credit: number }[];
};

export default function GeneralLedgerPage() {
  const { notify } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

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
      const data = (await apiGet(`/accounting/general-ledger?${qs.toString()}`)) as { groups: Group[] };
      setGroups(Array.isArray(data?.groups) ? data.groups : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load ledger");
    }
  }, [branchId, dateFrom, dateTo, notify]);

  useEffect(() => void load(), [load]);

  const totals = useMemo(() => {
    const debit = groups.reduce((s, g) => s + Number(g.debit || 0), 0);
    const credit = groups.reduce((s, g) => s + Number(g.credit || 0), 0);
    return { debit, credit };
  }, [groups]);

  return (
    <div className="space-y-4">
      <ReportHeader
        title="General Ledger"
        subtitle="Grouped by account. Expand to drill down into journal lines."
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
              <th className="p-3 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const isOpen = open[g.account_code] ?? false;
              return (
                <>
                  <tr key={g.account_code} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="p-3 font-medium">
                      <button className="hover:underline" onClick={() => setOpen((p) => ({ ...p, [g.account_code]: !isOpen }))}>
                        {g.account_code} — {g.name}
                      </button>
                    </td>
                    <td className="p-3 text-xs">{g.type}</td>
                    <td className="p-3 text-right font-mono tabular-nums">{Number(g.debit || 0).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono tabular-nums">{Number(g.credit || 0).toFixed(2)}</td>
                    <td className="p-3 text-right text-xs">{isOpen ? "Hide" : "Show"}</td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${g.account_code}-rows`} className="border-b border-slate-100 dark:border-slate-800/70">
                      <td colSpan={5} className="bg-slate-50/60 p-0 dark:bg-slate-900/30">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
                                <th className="p-2 text-left">Date</th>
                                <th className="p-2 text-left">Description</th>
                                <th className="p-2 text-right">Dr</th>
                                <th className="p-2 text-right">Cr</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.rows.map((r) => (
                                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/70 last:border-0">
                                  <td className="p-2 font-mono">{String(r.date).slice(0, 10)}</td>
                                  <td className="p-2">{r.description || "—"}</td>
                                  <td className="p-2 text-right font-mono tabular-nums">{Number(r.debit || 0).toFixed(2)}</td>
                                  <td className="p-2 text-right font-mono tabular-nums">{Number(r.credit || 0).toFixed(2)}</td>
                                </tr>
                              ))}
                              {!g.rows.length ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-slate-500">
                                    No lines
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
            {!groups.length ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No ledger rows.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="sticky bottom-0 border-t border-slate-200/60 bg-white p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="flex justify-end gap-6 font-mono tabular-nums">
            <span>Dr {totals.debit.toFixed(2)}</span>
            <span>Cr {totals.credit.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

