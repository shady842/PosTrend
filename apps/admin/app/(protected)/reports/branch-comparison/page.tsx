"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { apiGet } from "@/lib/api";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function BranchComparisonReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);

  const load = async (query: Record<string, string>) => {
    const [sales, bs] = await Promise.all([
      fetchReport("sales", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id }),
      apiGet("/branches")
    ]);
    const source = Array.isArray(sales?.data) ? sales.data : [];
    setBranches(Array.isArray(bs) ? bs : []);
    setRows(source);
  };

  useEffect(() => {
    void load({});
  }, []);

  const compared = useMemo(() => {
    const map = new Map<string, { branch: string; net_sales: number; orders: number }>();
    rows.forEach((r: any) => {
      const id = String(r.branch_id || "unknown");
      const branchName = branches.find((b) => b.id === id)?.name || id;
      const cur = map.get(id) || { branch: branchName, net_sales: 0, orders: 0 };
      cur.net_sales += Number(r.net_sales || 0);
      cur.orders += Number(r.orders || 0);
      map.set(id, cur);
    });
    return [...map.values()];
  }, [rows, branches]);

  return (
    <ReportShell
      title="Branch comparison"
      description="Branch comparison chart (sales and order count)."
      rows={compared as unknown as Record<string, unknown>[]}
      endpoint="branch-comparison"
      metricField="net_sales"
      labelField="branch"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("sales", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(`branch_comparison.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
