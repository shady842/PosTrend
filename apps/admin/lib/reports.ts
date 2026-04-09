"use client";

import { apiGet } from "@/lib/api";

export type GroupBy = "day" | "week" | "month";
export type ChartType = "line" | "bar" | "pie";

export type ReportQuery = {
  dateFrom?: string;
  dateTo?: string;
  branchId?: string;
  page?: number;
  pageSize?: number;
  exportFormat?: "csv" | "xlsx";
};

export async function fetchReport(path: string, q: ReportQuery) {
  const params = new URLSearchParams();
  if (q.dateFrom) params.set("date_from", q.dateFrom);
  if (q.dateTo) params.set("date_to", q.dateTo);
  if (q.branchId) params.set("branch_id", q.branchId);
  params.set("page", String(q.page || 1));
  params.set("page_size", String(q.pageSize || 200));
  if (q.exportFormat) params.set("export", q.exportFormat);
  return apiGet(`/reports/${path}?${params.toString()}`);
}

export function decodeBase64(base64: string) {
  if (typeof window === "undefined") return "";
  return window.atob(base64);
}

export function downloadTextFile(fileName: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function groupDateLabel(isoDate: string, groupBy: GroupBy) {
  const d = new Date(isoDate);
  if (groupBy === "day") return isoDate.slice(0, 10);
  if (groupBy === "week") {
    const first = new Date(d);
    first.setDate(d.getDate() - d.getDay());
    return `Wk ${first.toISOString().slice(0, 10)}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
