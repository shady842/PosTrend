"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { Modal } from "@/components/modal";
import { ReportFilters } from "@/components/reports/report-filters";
import { PivotTable } from "@/components/reports/pivot-table";
import { ExportButton } from "@/components/reports/export-button";
import { SavedReportsDropdown } from "@/components/reports/saved-reports-dropdown";
import { ChartType, GroupBy, groupDateLabel } from "@/lib/reports";
import { apiGet } from "@/lib/api";

const pieColors = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e", "#22c55e"];

type Props = {
  title: string;
  description: string;
  rows: Record<string, unknown>[];
  endpoint: string;
  metricField: string;
  labelField: string;
  onExport: (format: "csv" | "xlsx") => void;
  onReload: (query: Record<string, string>) => void;
};

export function ReportShell({ title, description, rows, endpoint, metricField, labelField, onExport, onReload }: Props) {
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branchId, setBranchId] = useState("");
  const [groupBy, setGroupBy] = useState<GroupBy>("day");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [fullscreen, setFullscreen] = useState(false);
  const [presetCurrent, setPresetCurrent] = useState("");

  useEffect(() => {
    void (async () => {
      const b = await apiGet("/branches");
      setBranches(Array.isArray(b) ? b : []);
    })();
  }, []);

  const chartData = useMemo(() => {
    if (!rows.length) return [];
    const mapped = new Map<string, number>();
    rows.forEach((r) => {
      const raw = String(r[labelField] ?? "");
      const key = raw.includes("-") ? groupDateLabel(raw, groupBy) : raw;
      mapped.set(key, (mapped.get(key) || 0) + Number(r[metricField] || 0));
    });
    return [...mapped.entries()].map(([name, value]) => ({ name, value }));
  }, [rows, labelField, metricField, groupBy]);

  const queryObj = {
    date_from: dateFrom,
    date_to: dateTo,
    branch_id: branchId
  };
  const queryStr = JSON.stringify(queryObj);

  const savePreset = () => {
    const key = `pt_report_presets_${endpoint}`;
    const name = prompt("Preset name");
    if (!name) return;
    const raw = localStorage.getItem(key);
    const current = raw ? (JSON.parse(raw) as Array<{ name: string; value: string }>) : [];
    current.push({ name, value: queryStr });
    localStorage.setItem(key, JSON.stringify(current));
  };

  const renderChart = (
    <ChartCard
      title={`${title} Chart`}
      subtitle={`Toggle: ${chartType.toUpperCase()} • Group by: ${groupBy}`}
      contentClassName="h-72"
    >
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "line" ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} />
          </LineChart>
        ) : chartType === "bar" ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
          </BarChart>
        ) : (
          <PieChart>
            <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={95}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={pieColors[i % pieColors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        )}
      </ResponsiveContainer>
    </ChartCard>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={description}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SavedReportsDropdown
              storageKey={`pt_report_presets_${endpoint}`}
              current={presetCurrent}
              onSelect={(value) => {
                setPresetCurrent(value);
                if (!value) return;
                try {
                  const v = JSON.parse(value) as Record<string, string>;
                  setDateFrom(v.date_from || "");
                  setDateTo(v.date_to || "");
                  setBranchId(v.branch_id || "");
                  onReload(v);
                } catch {
                  // ignore malformed preset
                }
              }}
              onSaveCurrent={savePreset}
            />
            <ExportButton onExport={onExport} />
            <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={() => setFullscreen(true)}>
              Fullscreen chart
            </button>
          </div>
        }
      />

      <ReportFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        branchId={branchId}
        branches={branches}
        groupBy={groupBy}
        chartType={chartType}
        onChange={(patch) => {
          if (patch.dateFrom !== undefined) setDateFrom(patch.dateFrom);
          if (patch.dateTo !== undefined) setDateTo(patch.dateTo);
          if (patch.branchId !== undefined) setBranchId(patch.branchId);
          if (patch.groupBy !== undefined) setGroupBy(patch.groupBy);
          if (patch.chartType !== undefined) setChartType(patch.chartType);
        }}
        onApply={() => onReload(queryObj)}
        onReset={() => {
          setDateFrom("");
          setDateTo("");
          setBranchId("");
          onReload({ date_from: "", date_to: "", branch_id: "" });
        }}
      />

      {renderChart}
      <PivotTable rows={rows} />

      <Modal open={fullscreen} title={`${title} - Fullscreen`} onClose={() => setFullscreen(false)}>
        <div className="h-[70vh]">{renderChart}</div>
      </Modal>
    </div>
  );
}
