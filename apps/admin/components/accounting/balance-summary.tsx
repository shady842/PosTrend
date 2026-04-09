"use client";

import { cn } from "@/lib/utils";

type Row = { label: string; value: string; subtle?: boolean };

export function BalanceSummary({
  title,
  rows,
  total
}: {
  title: string;
  rows: Row[];
  total?: { label: string; value: string };
}) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 space-y-2 text-sm">
        {rows.map((r) => (
          <div key={r.label} className={cn("flex items-center justify-between gap-3", r.subtle && "text-slate-500 dark:text-slate-400")}>
            <span>{r.label}</span>
            <span className="font-mono tabular-nums">{r.value}</span>
          </div>
        ))}
      </div>
      {total ? (
        <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-3 text-sm font-semibold dark:border-slate-700/60">
          <span>{total.label}</span>
          <span className="font-mono tabular-nums">{total.value}</span>
        </div>
      ) : null}
    </div>
  );
}

