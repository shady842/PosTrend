"use client";

import { useEffect, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function CashierReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = async (query: Record<string, string>) => {
    const data = await fetchReport("cashier", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id });
    setRows(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    void load({});
  }, []);

  return (
    <ReportShell
      title="Cashier report"
      description="Cashier sales and orders comparison."
      rows={rows}
      endpoint="cashier"
      metricField="sales"
      labelField="user_id"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("cashier", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(exp.file_name || `cashier.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
