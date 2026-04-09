"use client";

import { useState } from "react";

type Method = { id: string; name: string; enabled: boolean };

type Props = {
  rows: Method[];
  onChange: (rows: Method[]) => void;
};

export function PaymentMethodList({ rows, onChange }: Props) {
  const [name, setName] = useState("");

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">Payment Methods</h3>
      <div className="mt-3 flex gap-2">
        <input placeholder="Add payment method" value={name} onChange={(e) => setName(e.target.value)} />
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            onChange([...rows, { id: crypto.randomUUID(), name: trimmed, enabled: true }]);
            setName("");
          }}
        >
          Add
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2 dark:border-slate-700">
            <input
              className="w-[220px]"
              value={m.name}
              onChange={(e) => onChange(rows.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x)))}
            />
            <label className="inline-flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={m.enabled}
                onChange={(e) => onChange(rows.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x)))}
              />
              Enabled
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
