"use client";

import { useEffect, useState } from "react";
import { ReportShell } from "@/components/reports/report-shell";
import { decodeBase64, downloadTextFile, fetchReport } from "@/lib/reports";

export default function DiscountReportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);

  const load = async (query: Record<string, string>) => {
    const data = await fetchReport("discounts-refunds", { dateFrom: query.date_from, dateTo: query.date_to, branchId: query.branch_id });
    setRows(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    void load({});
  }, []);

  return (
    <ReportShell
      title="Discount report"
      description="Discount and refund totals."
      rows={rows}
      endpoint="discount"
      metricField="discount_total"
      labelField="refund_total"
      onReload={load}
      onExport={async (format) => {
        const exp = await fetchReport("discounts-refunds", { exportFormat: format, pageSize: 2000 });
        if (exp?.content_base64) downloadTextFile(exp.file_name || `discounts.${format}`, decodeBase64(exp.content_base64));
      }}
    />
  );
}
