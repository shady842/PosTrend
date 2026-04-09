"use client";

import { cn } from "@/lib/utils";

type Tab = { id: string; label: string };

type Props = {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
};

export function SettingsTabs({ tabs, active, onChange }: Props) {
  return (
    <div className="card mb-4 flex flex-wrap gap-2 p-3">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            active === t.id ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
