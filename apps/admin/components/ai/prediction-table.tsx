"use client";

import { ConfidenceBadge } from "@/components/ai/confidence-badge";

type Row = {
  item: string;
  demand: number;
  stockOutAt?: string | null;
  confidence: number;
};

type Props = { rows: Row[] };

export function PredictionTable({ rows }: Props) {
  return (
    <div className="card overflow-x-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Demand Prediction</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
            <th className="py-2">Item</th>
            <th className="py-2">Predicted Demand</th>
            <th className="py-2">Stock-out ETA</th>
            <th className="py-2">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.item}-${i}`} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-3">{r.item}</td>
              <td className="py-3">{r.demand.toFixed(2)}</td>
              <td className="py-3">{r.stockOutAt ? String(r.stockOutAt).slice(0, 10) : "N/A"}</td>
              <td className="py-3">
                <ConfidenceBadge value={r.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
