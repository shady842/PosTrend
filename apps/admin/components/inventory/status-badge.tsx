"use client";

import { cn } from "@/lib/utils";

const variants: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100",
  approved: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  received: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  in_transit: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  inactive: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  low: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
  ok: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const cls = variants[key] || variants.ok;
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", cls)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
