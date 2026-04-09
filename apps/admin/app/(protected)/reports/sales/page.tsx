"use client";

import { useEffect, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function SalesReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = async (query: Record<string, string>) => {
    const data = await fetchReport("sales", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id });
    setRows(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    void load({});
  }, []);

  return (
    <ReportShell
      title="Sales report"
      description="Sales line chart with date grouping and pivot table."
      rows={rows}
      endpoint="sales"
      metricField="net_sales"
      labelField="date"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("sales", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(exp.file_name || `sales.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
