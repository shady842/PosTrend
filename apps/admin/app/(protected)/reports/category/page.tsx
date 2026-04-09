"use client";

import { useEffect, useMemo, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function CategoryReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = async (query: Record<string, string>) => {
    const data = await fetchReport("items", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id });
    const source = Array.isArray(data?.data) ? data.data : [];
    const mapped = source.map((r: any) => {
      const name = String(r.item_name || "Other");
      const category = name.includes(" ") ? name.split(" ")[0] : "General";
      return { category, revenue: Number(r.revenue || 0), qty: Number(r.qty || 0) };
    });
    setRows(mapped);
  };

  useEffect(() => {
    void load({});
  }, []);

  const categoryRows = useMemo(() => {
    const map = new Map<string, { category: string; revenue: number; qty: number }>();
    rows.forEach((r: any) => {
      const key = r.category;
      const cur = map.get(key) || { category: key, revenue: 0, qty: 0 };
      cur.revenue += Number(r.revenue || 0);
      cur.qty += Number(r.qty || 0);
      map.set(key, cur);
    });
    return [...map.values()];
  }, [rows]);

  return (
    <ReportShell
      title="Category report"
      description="Category pie/bar analysis (derived from item dataset)."
      rows={categoryRows as unknown as Record<string, unknown>[]}
      endpoint="category"
      metricField="revenue"
      labelField="category"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("items", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(`category.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
