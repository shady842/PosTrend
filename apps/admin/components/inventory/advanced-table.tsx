"use client";

import { ReactNode, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Columns3, LayoutGrid, List, Search, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export type InvColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Hide by default until user enables column */
  defaultHidden?: boolean;
  /** Search substring in this string from row */
  searchValue?: (row: T) => string;
};

type Props<T> = {
  data: T[];
  columns: InvColumn<T>[];
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  viewStorageKey: string;
  rowClassName?: (row: T) => string | undefined;
  bulkActions?: { id: string; label: string; onClick: (ids: string[]) => void }[];
  emptyMessage?: string;
};

export function AdvancedInventoryTable<T>({
  data,
  columns,
  getRowId,
  searchPlaceholder = "Search…",
  viewStorageKey,
  rowClassName,
  bulkActions,
  emptyMessage = "No rows"
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "card">(() => {
    if (typeof window === "undefined") return "list";
    return (localStorage.getItem(`${viewStorageKey}_view`) as "list" | "card") || "list";
  });
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of columns) init[c.key] = !c.defaultHidden;
    return init;
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showCols, setShowCols] = useState(false);

  const setViewMode = (v: "list" | "card") => {
    setView(v);
    localStorage.setItem(`${viewStorageKey}_view`, v);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      return columns.some((col) => {
        const fn = col.searchValue;
        if (!fn) return false;
        return fn(row).toLowerCase().includes(q);
      });
    });
  }, [data, query, columns]);

  const visibleCols = columns.filter((c) => visible[c.key]);

  const allFilteredIds = filtered.map(getRowId);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.has(id));

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportCsv = () => {
    const rows = selected.size
      ? filtered.filter((r) => selected.has(getRowId(r)))
      : filtered;
    if (!rows.length) return;
    const headers = visibleCols.map((c) => c.header);
    const lines = [headers.join(",")];
    for (const row of rows) {
      const cells = visibleCols.map((c) => {
        const raw = c.searchValue ? c.searchValue(row) : "";
        const s = String(raw).replace(/"/g, '""');
        return `"${s}"`;
      });
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="relative min-w-[200px] max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full py-2 pl-9"
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 p-0.5 dark:border-slate-700">
            <button
              type="button"
              className={cn(
                "rounded-lg px-2 py-1.5",
                view === "list" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"
              )}
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-2 py-1.5",
                view === "card" ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-300"
              )}
              onClick={() => setViewMode("card")}
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
              onClick={() => setShowCols((s) => !s)}
            >
              <Columns3 className="h-4 w-4" />
              Columns
            </button>
            {showCols && (
              <div className="absolute right-0 z-20 mt-1 min-w-[200px] rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {columns.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={visible[c.key]}
                      onChange={() => setVisible((v) => ({ ...v, [c.key]: !v[c.key] }))}
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            )}
          </div>
          <button type="button" className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selected.size > 0 && bulkActions?.length ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm dark:border-indigo-500/40 dark:bg-indigo-500/10"
          >
            <span className="font-medium text-indigo-900 dark:text-indigo-100">{selected.size} selected</span>
            {bulkActions.map((a) => (
              <button
                key={a.id}
                type="button"
                className="rounded-lg bg-indigo-600 px-3 py-1 text-white hover:bg-indigo-500"
                onClick={() => a.onClick([...selected])}
              >
                {a.label}
              </button>
            ))}
            <button type="button" className="text-indigo-700 underline dark:text-indigo-300" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {view === "list" ? (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-700/70">
                <th className="w-10 p-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                {visibleCols.map((col) => (
                  <th key={col.key} className="p-3 text-left font-medium muted">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="p-8 text-center muted">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                filtered.map((row, idx) => {
                  const id = getRowId(row);
                  const rc = rowClassName?.(row);
                  return (
                    <motion.tr
                      key={id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                      className={cn("border-b border-slate-100 dark:border-slate-800/80 last:border-0", rc)}
                    >
                      <td className="p-3">
                        <input type="checkbox" checked={selected.has(id)} onChange={() => toggleOne(id)} aria-label="Select row" />
                      </td>
                      {visibleCols.map((col) => (
                        <td key={col.key} className="p-3">
                          {col.render(row)}
                        </td>
                      ))}
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.length === 0 ? (
            <div className="col-span-full card p-8 text-center muted">{emptyMessage}</div>
          ) : (
            filtered.map((row) => {
              const id = getRowId(row);
              const rc = rowClassName?.(row);
              return (
                <motion.div
                  key={id}
                  layout
                  className={cn(
                    "card flex flex-col gap-2 p-4 ring-1 ring-transparent transition hover:ring-indigo-500/20",
                    rc
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggleOne(id)} />
                  </div>
                  {visibleCols.map((col) => (
                    <div key={col.key} className="flex justify-between gap-2 text-sm">
                      <span className="muted">{col.header}</span>
                      <span className="text-right font-medium">{col.render(row)}</span>
                    </div>
                  ))}
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
