"use client";

type Props = {
  onExport: (format: "csv" | "xlsx") => void;
};

export function ExportButton({ onExport }: Props) {
  return (
    <div className="flex gap-2">
      <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={() => onExport("csv")}>
        Export CSV
      </button>
      <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={() => onExport("xlsx")}>
        Download Excel
      </button>
    </div>
  );
}
