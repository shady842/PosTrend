"use client";

import { ConfidenceBadge } from "@/components/ai/confidence-badge";

type Row = {
  inventoryItemId: string;
  itemName: string;
  suggestedQty: number;
  reason?: string;
  confidence: number;
  status?: string;
};

type Props = {
  rows: Row[];
  onApply: (inventoryItemId: string) => void;
};

export function RecommendationPanel({ rows, onApply }: Props) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">Reorder Suggestions</h3>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.inventoryItemId} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{r.itemName}</p>
              <ConfidenceBadge value={r.confidence} />
            </div>
            <p className="muted mt-1 text-xs">
              Suggested reorder: {r.suggestedQty.toFixed(2)} | Reason: {r.reason || "AI signal"}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="muted text-xs">Status: {r.status || "suggested"}</span>
              <button
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={r.status === "applied"}
                onClick={() => onApply(r.inventoryItemId)}
              >
                Apply recommendation
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
