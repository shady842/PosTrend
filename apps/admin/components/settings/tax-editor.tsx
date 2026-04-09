"use client";

import { useState } from "react";

export type TaxRule = { id: string; name: string; rate: number; enabled: boolean };

type Props = {
  title: string;
  rows: TaxRule[];
  onChange: (rows: TaxRule[]) => void;
};

export function TaxEditor({ title, rows, onChange }: Props) {
  const [name, setName] = useState("");
  const [rate, setRate] = useState("0");

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 flex flex-wrap gap-2">
        <input placeholder="Rule name" value={name} onChange={(e) => setName(e.target.value)} />
        <input type="number" step="0.01" min="0" placeholder="Rate %" value={rate} onChange={(e) => setRate(e.target.value)} />
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            onChange([
              ...rows,
              { id: crypto.randomUUID(), name: trimmed, rate: Number(rate || 0), enabled: true }
            ]);
            setName("");
            setRate("0");
          }}
        >
          Add
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <div className="text-sm">
              {r.name} <span className="muted">({r.rate.toFixed(2)}%)</span>
            </div>
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={r.enabled}
                onChange={(e) => onChange(rows.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))}
              />
              Enabled
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
