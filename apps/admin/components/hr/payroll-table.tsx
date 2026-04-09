"use client";

type PayrollRun = {
  id: string;
  employeeId: string;
  periodStart: string;
  netSalary: number | string;
  status: string;
  grossSalary: number | string;
  deductions: number | string;
};

type Props = {
  rows: PayrollRun[];
  employeeNameById: Record<string, string>;
  onProcess: (id: string) => void;
  onViewBreakdown: (row: PayrollRun) => void;
};

export function PayrollTable({ rows, employeeNameById, onProcess, onViewBreakdown }: Props) {
  return (
    <div className="card overflow-x-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Payroll Runs</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
            <th className="py-2">Employee</th>
            <th className="py-2">Month</th>
            <th className="py-2">Net Pay</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-3">{employeeNameById[r.employeeId] || "Unknown"}</td>
              <td className="py-3">{String(r.periodStart).slice(0, 7)}</td>
              <td className="py-3">৳{Number(r.netSalary || 0).toLocaleString()}</td>
              <td className="py-3">
                <span
                  className={`rounded-full px-2 py-1 text-xs ${
                    r.status === "processed" || r.status === "paid"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {r.status}
                </span>
              </td>
              <td className="py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button className="rounded-lg bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800" onClick={() => onViewBreakdown(r)}>
                    Breakdown
                  </button>
                  <button
                    className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => onProcess(r.id)}
                    disabled={r.status === "processed" || r.status === "paid"}
                  >
                    Process
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
