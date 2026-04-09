"use client";

import { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { ConfidenceBadge } from "@/components/ai/confidence-badge";

type Props = {
  title: string;
  value: string;
  trend: "up" | "down";
  note?: string;
  confidence?: number;
  extra?: ReactNode;
};

export function AIInsightCard({ title, value, trend, note, confidence, extra }: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="muted text-sm">{title}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex items-center gap-2">
          {confidence !== undefined ? <ConfidenceBadge value={confidence} /> : null}
          {trend === "up" ? (
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <TrendingDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          )}
        </div>
      </div>
      {note ? <p className="muted mt-3 text-xs">{note}</p> : null}
      {extra ? <div className="mt-3">{extra}</div> : null}
    </div>
  );
}
