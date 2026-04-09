"use client";

import { ChartType, GroupBy } from "@/lib/reports";

type Branch = { id: string; name: string };

type Props = {
  dateFrom: string;
  dateTo: string;
  branchId: string;
  branches: Branch[];
  groupBy: GroupBy;
  chartType: ChartType;
  onChange: (patch: Partial<{ dateFrom: string; dateTo: string; branchId: string; groupBy: GroupBy; chartType: ChartType }>) => void;
  onApply: () => void;
  onReset: () => void;
};

export function ReportFilters({ dateFrom, dateTo, branchId, branches, groupBy, chartType, onChange, onApply, onReset }: Props) {
  return (
    <div className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
      <input type="date" value={dateFrom} onChange={(e) => onChange({ dateFrom: e.target.value })} />
      <input type="date" value={dateTo} onChange={(e) => onChange({ dateTo: e.target.value })} />
      <select value={branchId} onChange={(e) => onChange({ branchId: e.target.value })}>
        <option value="">Branch</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
      <select value={groupBy} onChange={(e) => onChange({ groupBy: e.target.value as GroupBy })}>
        <option value="day">Group: Day</option>
        <option value="week">Group: Week</option>
        <option value="month">Group: Month</option>
      </select>
      <select value={chartType} onChange={(e) => onChange({ chartType: e.target.value as ChartType })}>
        <option value="line">Line chart</option>
        <option value="bar">Bar chart</option>
        <option value="pie">Pie chart</option>
      </select>
      <div className="flex gap-2">
        <button className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white" onClick={onApply}>
          Apply
        </button>
        <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
