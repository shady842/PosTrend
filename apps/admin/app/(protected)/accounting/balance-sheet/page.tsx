"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import { ReportHeader } from "@/components/accounting/report-header";
import { BalanceSummary } from "@/components/accounting/balance-summary";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };

export default function BalanceSheetPage() {
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
      const d = await apiGet(`/accounting/balance-sheet?${qs.toString()}`);
      setData(d);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load balance sheet");
    }
  }, [branchId, dateFrom, dateTo, notify]);

  useEffect(() => void load(), [load]);

  const assets = useMemo(() => (Array.isArray(data?.assets) ? data.assets : []), [data]);
  const liabilities = useMemo(() => (Array.isArray(data?.liabilities) ? data.liabilities : []), [data]);
  const equity = useMemo(() => (Array.isArray(data?.equity) ? data.equity : []), [data]);

  const rowify = (rows: any[]) =>
    rows.map((r) => ({
      label: `${r.code} — ${r.name}`,
      value: Number(r.balance || 0).toFixed(2)
    }));

  return (
    <div className="space-y-4">
      <ReportHeader
        title="Balance Sheet"
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

      <div className="grid gap-4 lg:grid-cols-3">
        <BalanceSummary title="Assets" rows={rowify(assets)} total={{ label: "Total assets", value: Number(data?.total_assets || 0).toFixed(2) }} />
        <BalanceSummary
          title="Liabilities"
          rows={rowify(liabilities)}
          total={{ label: "Total liabilities", value: Number(data?.total_liabilities || 0).toFixed(2) }}
        />
        <BalanceSummary title="Equity" rows={rowify(equity)} total={{ label: "Total equity", value: Number(data?.total_equity || 0).toFixed(2) }} />
      </div>
    </div>
  );
}

