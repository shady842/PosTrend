"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line } from "recharts";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { StatCard } from "@/components/stat-card";
import { apiGet } from "@/lib/api";

const pages = [
  { href: "/hr/employees", label: "Employees list" },
  { href: "/hr/attendance", label: "Attendance" },
  { href: "/hr/shifts", label: "Shifts" },
  { href: "/hr/leaves", label: "Leaves" },
  { href: "/hr/payroll", label: "Payroll" },
  { href: "/hr/departments", label: "Departments" }
];

export default function HrOverviewPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const [e, a, l, p] = await Promise.all([apiGet("/hr/employees"), apiGet("/hr/attendance"), apiGet("/hr/leave-requests"), apiGet("/hr/payroll")]);
      setEmployees(Array.isArray(e) ? e : []);
      setAttendance(Array.isArray(a) ? a : []);
      setLeaves(Array.isArray(l) ? l : []);
      setPayroll(Array.isArray(p) ? p : []);
    })();
  }, []);

  const attendanceOverview = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0 };
    attendance.forEach((a) => {
      const key = a.status as "present" | "late" | "absent";
      if (key in result) result[key] += 1;
    });
    return [
      { label: "Present", value: result.present },
      { label: "Late", value: result.late },
      { label: "Absent", value: result.absent }
    ];
  }, [attendance]);

  const headcountGrowth = [
    { month: "Jan", value: 8 },
    { month: "Feb", value: 9 },
    { month: "Mar", value: 10 },
    { month: "Apr", value: employees.length }
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="HR & Payroll" description="Workforce operations, attendance, leaves, and payroll processing." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Employees" value={`${employees.length}`} />
        <StatCard label="Pending Leaves" value={`${leaves.filter((l) => l.status === "pending").length}`} />
        <StatCard label="Pending Payroll Runs" value={`${payroll.filter((p) => p.status === "draft").length}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Attendance Overview">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={attendanceOverview}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Headcount Growth">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={headcountGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {pages.map((p) => (
          <Link key={p.href} href={p.href} className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
