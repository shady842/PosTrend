"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { HrNav } from "@/components/hr/hr-nav";
import { LeaveApprovalDialog } from "@/components/hr/leave-approval-dialog";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/components/toast";

export default function LeavesPage() {
  const { notify } = useToast();
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({
    employeeId: "",
    type: "annual" as "annual" | "sick" | "unpaid",
    startDate: "",
    endDate: ""
  });

  const load = async () => {
    const [e, l] = await Promise.all([apiGet("/hr/employees"), apiGet("/hr/leave-requests")]);
    setEmployees(Array.isArray(e) ? e : []);
    setLeaves(Array.isArray(l) ? l : []);
    if (!form.employeeId && Array.isArray(e) && e[0]?.id) setForm((p) => ({ ...p, employeeId: e[0].id }));
  };

  useEffect(() => {
    void load();
  }, []);

  const employeeNameById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.fullName])), [employees]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.startDate || !form.endDate) return;
    try {
      await apiPost("/hr/leave-request", {
        employee_id: form.employeeId,
        leave_type: form.type,
        start_date: form.startDate,
        end_date: form.endDate,
        status: "pending"
      });
      await load();
      setForm({ ...form, startDate: "", endDate: "" });
      notify("Leave request submitted");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to submit request");
    }
  };

  const applyDecision = async (status: "approved" | "rejected") => {
    if (!selected) return;
    await apiPost(`/hr/leave-request/${selected.id}/decision`, { status });
    await load();
    setSelected(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Leaves" description="Submit and approve/reject leave requests." />
      <HrNav />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold">New Leave Request</h3>
          <form className="mt-3 space-y-2" onSubmit={submit}>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "annual" | "sick" | "unpaid" })}>
              <option value="annual">Annual</option>
              <option value="sick">Sick</option>
              <option value="unpaid">Unpaid</option>
            </select>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            <button className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Submit Request</button>
          </form>
        </div>
        <div className="card overflow-x-auto p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Leave Approval Queue</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                <th className="py-2">Employee</th>
                <th className="py-2">Type</th>
                <th className="py-2">Dates</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {leaves.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3">{employeeNameById[l.employeeId] || l.employee?.fullName || "Unknown"}</td>
                  <td className="py-3 capitalize">{l.leaveType}</td>
                  <td className="py-3">
                    {String(l.startDate).slice(0, 10)} to {String(l.endDate).slice(0, 10)}
                  </td>
                  <td className="py-3 capitalize">{l.status}</td>
                  <td className="py-3 text-right">
                    <button className="rounded-lg bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800" onClick={() => setSelected(l)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <LeaveApprovalDialog
        open={!!selected}
        leave={selected}
        employeeName={selected ? employeeNameById[selected.employeeId] : ""}
        onClose={() => setSelected(null)}
        onApprove={() => applyDecision("approved")}
        onReject={() => applyDecision("rejected")}
      />
    </div>
  );
}
