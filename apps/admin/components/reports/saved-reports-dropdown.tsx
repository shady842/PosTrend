"use client";

import { useMemo } from "react";

type Preset = { name: string; value: string };

type Props = {
  storageKey: string;
  current: string;
  onSelect: (value: string) => void;
  onSaveCurrent: () => void;
};

export function SavedReportsDropdown({ storageKey, current, onSelect, onSaveCurrent }: Props) {
  const presets = useMemo(() => {
    if (typeof window === "undefined") return [] as Preset[];
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [] as Preset[];
    try {
      return JSON.parse(raw) as Preset[];
    } catch {
      return [] as Preset[];
    }
  }, [storageKey, current]);

  return (
    <div className="flex items-center gap-2">
      <select className="min-w-[200px]" value={current} onChange={(e) => onSelect(e.target.value)}>
        <option value="">Saved report presets</option>
        {presets.map((p) => (
          <option key={p.name} value={p.value}>
            {p.name}
          </option>
        ))}
      </select>
      <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={onSaveCurrent}>
        Save preset
      </button>
    </div>
  );
}
