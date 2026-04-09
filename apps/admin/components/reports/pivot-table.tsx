"use client";

type Row = Record<string, unknown>;

type Props = {
  rows: Row[];
};

export function PivotTable({ rows }: Props) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return (
    <div className="card overflow-x-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Pivot-style table</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
            {headers.map((h) => (
              <th key={h} className="py-2 pr-3">
                {h.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              {headers.map((h) => (
                <td key={h} className="py-2 pr-3">
                  {String(r[h] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
