"use client";

import { ReactNode } from "react";
import { CalendarRange, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { id: string; name: string };

type Props = {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  branchId: string;
  branches: Option[];
  onBranchChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
};

export function ReportHeader({
  title,
  subtitle,
  left,
  right,
  branchId,
  branches,
  onBranchChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange
}: Props) {
  return (
    <div className="card p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-500" />
            <h1 className="truncate text-xl font-semibold">{title}</h1>
          </div>
          {subtitle ? <p className="muted mt-1 text-sm">{subtitle}</p> : null}
          {left}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="muted text-[10px] font-semibold uppercase tracking-wider">Branch</label>
            <select className="mt-1 w-full" value={branchId} onChange={(e) => onBranchChange(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="muted flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider">
              <CalendarRange className="h-3.5 w-3.5" />
              From
            </label>
            <input className="mt-1 w-full" type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
          </div>
          <div className="min-w-[150px]">
            <label className="muted text-[10px] font-semibold uppercase tracking-wider">To</label>
            <input className="mt-1 w-full" type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
          </div>

          <div className={cn("flex items-center gap-2", !right && "hidden")} aria-hidden={!right}>
            {right}
          </div>
        </div>
      </div>
    </div>
  );
}

