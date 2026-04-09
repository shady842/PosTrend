"use client";

import Link from "next/link";
import { HrEmployee } from "@/lib/hr-api";

type Props = {
  employee: HrEmployee;
  departmentName: string;
  onClock: (employeeId: string) => void;
};

function getInitials(fullName: string) {
  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("");
}

const statusClass: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  probation: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  on_leave: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  inactive: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
};

export function EmployeeCard({ employee, departmentName, onClock }: Props) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
            {getInitials(employee.fullName)}
          </div>
          <div>
            <p className="font-semibold">{employee.fullName}</p>
            <p className="muted text-xs">{employee.role?.name || "—"}</p>
          </div>
        </div>
        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass[employee.status] || statusClass.active}`}>
          {employee.status.replace("_", " ")}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <p className="muted">Branch</p>
        <p>{employee.branch?.name || "—"}</p>
        <p className="muted">Department</p>
        <p>{departmentName}</p>
        <p className="muted">Joined</p>
        <p>{String(employee.dateJoined).slice(0, 10)}</p>
      </div>

      <div className="mt-4 flex gap-2">
        <Link href={`/hr/employees/${employee.id}`} className="rounded-lg bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800">
          Profile
        </Link>
        <button onClick={() => onClock(employee.id)} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs text-white hover:bg-indigo-500">
          Clock In/Out
        </button>
      </div>
    </div>
  );
}
