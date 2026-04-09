"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { HrNav } from "@/components/hr/hr-nav";
import { PayrollTable } from "@/components/hr/payroll-table";
import { Modal } from "@/components/modal";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { ChartCard } from "@/components/chart-card";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/components/toast";

export default function PayrollPage() {
  const { notify } = useToast();
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const load = async () => {
    const [e, p] = await Promise.all([apiGet("/hr/employees"), apiGet("/hr/payroll")]);
    setEmployees(Array.isArray(e) ? e : []);
    setPayroll(Array.isArray(p) ? p : []);
  };

  useEffect(() => {
    void load();
  }, []);

  const employeeNameById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.fullName])), [employees]);
  const totalCost = payroll.reduce((sum, p) => sum + Number(p.netSalary || 0), 0);
  const processed = payroll.filter((p) => p.status === "processed" || p.status === "paid").length;

  const payrollCostChart = useMemo(() => {
    const byMonth: Record<string, number> = {};
    payroll.forEach((p) => {
      const month = String(p.periodStart).slice(0, 7);
      byMonth[month] = (byMonth[month] || 0) + Number(p.netSalary || 0);
    });
    return Object.entries(byMonth).map(([month, cost]) => ({ month, cost }));
  }, [payroll]);

  return (
    <div className="space-y-4">
      <PageHeader title="Payroll" description="Payroll processing, cost chart, and salary breakdown." />
      <HrNav />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total Payroll Cost" value={`৳${totalCost.toLocaleString()}`} />
        <StatCard label="Processed Runs" value={`${processed}`} />
        <StatCard label="Pending Runs" value={`${payroll.length - processed}`} />
      </div>
      <ChartCard title="Payroll Cost Chart" subtitle="Monthly payroll cost trend">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={payrollCostChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="cost" stroke="#0ea5e9" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
      <PayrollTable
        rows={payroll}
        employeeNameById={employeeNameById}
        onProcess={async (id) => {
          const row = payroll.find((p) => p.id === id);
          if (!row) return;
          await apiPost("/hr/payroll-process", {
            employee_id: row.employeeId,
            period_start: row.periodStart,
            period_end: row.periodEnd,
            gross_salary: Number(row.grossSalary || 0),
            deductions: Number(row.deductions || 0),
            status: "processed"
          });
          await load();
          notify("Payroll processed");
        }}
        onViewBreakdown={setSelected}
      />

      <Modal open={!!selected} title="Salary Breakdown" onClose={() => setSelected(null)}>
        {!selected ? null : (
          <div className="space-y-2 text-sm">
            <p>Employee: {employeeNameById[selected.employeeId]}</p>
            <p>Gross Salary: ৳{Number(selected.grossSalary || 0).toLocaleString()}</p>
            <p>Deductions: ৳{Number(selected.deductions || 0).toLocaleString()}</p>
            <p className="font-semibold">Net Pay: ৳{Number(selected.netSalary || 0).toLocaleString()}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
