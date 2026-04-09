"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/hr/employees", label: "Employees" },
  { href: "/hr/attendance", label: "Attendance" },
  { href: "/hr/shifts", label: "Shifts" },
  { href: "/hr/leaves", label: "Leaves" },
  { href: "/hr/payroll", label: "Payroll" },
  { href: "/hr/departments", label: "Departments" }
];

export function HrNav() {
  const pathname = usePathname();
  return (
    <div className="card mb-4 flex flex-wrap gap-2 p-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            pathname.startsWith(item.href) ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
