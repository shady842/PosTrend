"use client";

import { useEffect, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function InventoryReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = async (query: Record<string, string>) => {
    const data = await fetchReport("inventory", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id });
    setRows(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    void load({});
  }, []);

  return (
    <ReportShell
      title="Inventory report"
      description="Inventory status with low-stock focus."
      rows={rows}
      endpoint="inventory"
      metricField="stock_level"
      labelField="name"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("inventory", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(exp.file_name || `inventory.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
