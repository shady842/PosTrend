"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  tone?: "good" | "warn" | "bad" | "neutral";
};

export function FinancialCard({ title, value, delta, icon, tone = "neutral" }: Props) {
  const toneClass =
    tone === "good"
      ? "bg-emerald-500/10 ring-1 ring-emerald-500/25"
      : tone === "warn"
        ? "bg-amber-500/10 ring-1 ring-amber-500/25"
        : tone === "bad"
          ? "bg-rose-500/10 ring-1 ring-rose-500/25"
          : "bg-slate-500/5 ring-1 ring-slate-200/60 dark:ring-slate-700/60";

  return (
    <div className={cn("card p-4", toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="muted text-xs font-medium">{title}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
          {delta ? <p className="muted mt-1 text-xs">{delta}</p> : null}
        </div>
        {icon ? <div className="rounded-xl bg-white/60 p-2 dark:bg-slate-900/40">{icon}</div> : null}
      </div>
    </div>
  );
}

