"use client";

type Props = { value: number };

export function ConfidenceBadge({ value }: Props) {
  const pct = Math.round((value || 0) * 100);
  const cls =
    pct >= 80
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : pct >= 60
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  return <span className={`rounded-full px-2 py-1 text-xs font-medium ${cls}`}>Confidence {pct}%</span>;
}
