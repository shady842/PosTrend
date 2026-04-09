"use client";

import { useEffect, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function ItemsReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = async (query: Record<string, string>) => {
    const data = await fetchReport("items", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id });
    setRows(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    void load({});
  }, []);

  return (
    <ReportShell
      title="Items report"
      description="Top items bar chart and pivot table."
      rows={rows}
      endpoint="items"
      metricField="revenue"
      labelField="item_name"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("items", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(exp.file_name || `items.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
