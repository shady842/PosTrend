"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { HrNav } from "@/components/hr/hr-nav";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/components/toast";

export default function ShiftsPage() {
  const { notify } = useToast();
  const [employees, setEmployees] = useState<Array<{ id: string; fullName: string }>>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [form, setForm] = useState({
    employeeId: "",
    date: "",
    shiftId: ""
  });
  const [newShift, setNewShift] = useState({ name: "", startTime: "09:00", endTime: "18:00" });

  const load = async () => {
    const [e, s, a] = await Promise.all([apiGet("/hr/employees"), apiGet("/hr/shifts"), apiGet("/hr/shift-assignments")]);
    setEmployees(Array.isArray(e) ? e : []);
    setShiftTemplates(Array.isArray(s) ? s : []);
    setAssignments(Array.isArray(a) ? a : []);
    if (Array.isArray(e) && e[0]?.id && !form.employeeId) setForm((p) => ({ ...p, employeeId: e[0].id }));
    if (Array.isArray(s) && s[0]?.id && !form.shiftId) setForm((p) => ({ ...p, shiftId: s[0].id }));
  };

  useEffect(() => {
    void load();
  }, []);

  const employeeNameById = useMemo(() => Object.fromEntries(employees.map((e) => [e.id, e.fullName])), [employees]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.employeeId || !form.date || !form.shiftId) return;
    await apiPost("/hr/shifts/assign", { employee_id: form.employeeId, shift_id: form.shiftId, assignment_date: form.date });
    await load();
    notify("Shift assigned");
    setForm({ ...form, date: "" });
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Shifts" description="Plan team shifts by branch and date." />
      <HrNav />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold">Create Shift</h3>
          <form className="mt-3 space-y-2" onSubmit={submit}>
            <select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.fullName}
                </option>
              ))}
            </select>
            <select value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}>
              {shiftTemplates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <button className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white">Save Shift</button>
          </form>
          <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
            <p className="mb-2 text-xs font-semibold uppercase">Create Shift Template</p>
            <div className="space-y-2">
              <input value={newShift.name} onChange={(e) => setNewShift({ ...newShift, name: e.target.value })} placeholder="Shift name" />
              <input type="time" value={newShift.startTime} onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })} />
              <input type="time" value={newShift.endTime} onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })} />
              <button
                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
                onClick={async () => {
                  const today = new Date().toISOString().slice(0, 10);
                  await apiPost("/hr/shifts", {
                    name: newShift.name || "General Shift",
                    start_time: `${today}T${newShift.startTime}:00.000Z`,
                    end_time: `${today}T${newShift.endTime}:00.000Z`,
                    status: "OPEN"
                  });
                  await load();
                }}
              >
                Add Shift Template
              </button>
            </div>
          </div>
        </div>
        <div className="card overflow-x-auto p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold">Shift Planner</h3>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
                <th className="py-2">Employee</th>
                <th className="py-2">Date</th>
                <th className="py-2">Time</th>
                <th className="py-2">Location</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-3">{employeeNameById[s.employeeId] || "Unknown"}</td>
                  <td className="py-3">{String(s.assignmentDate).slice(0, 10)}</td>
                  <td className="py-3">
                    {s.shift?.name || "-"}
                  </td>
                  <td className="py-3">
                    {s.shift?.startTime ? String(s.shift.startTime).slice(11, 16) : "--:--"} -{" "}
                    {s.shift?.endTime ? String(s.shift.endTime).slice(11, 16) : "--:--"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
