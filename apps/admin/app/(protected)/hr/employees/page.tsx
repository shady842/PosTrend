"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DrawerPanel } from "@/components/drawer-panel";
import { HrNav } from "@/components/hr/hr-nav";
import { EmployeeCard } from "@/components/hr/employee-card";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPost } from "@/lib/api";
import { HrDepartment, HrEmployee, HrRole, listDepartments, listEmployees, listRoles } from "@/lib/hr-api";
import { useToast } from "@/components/toast";

export default function EmployeesPage() {
  const { notify } = useToast();
  const [employees, setEmployees] = useState<HrEmployee[]>([]);
  const [departments, setDepartments] = useState<HrDepartment[]>([]);
  const [roles, setRoles] = useState<HrRole[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    fullName: "",
    roleId: "",
    branchId: "",
    departmentId: "",
    employmentType: "full_time",
    status: "active",
    dateJoined: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    void (async () => {
      try {
        const [e, d, r, b] = await Promise.all([listEmployees(), listDepartments(), listRoles(), apiGet("/branches")]);
        setEmployees(e || []);
        setDepartments(d || []);
        setRoles(r || []);
        setBranches(Array.isArray(b) ? b : []);
        setForm((prev) => ({
          ...prev,
          departmentId: d?.[0]?.id || "",
          roleId: r?.[0]?.id || "",
          branchId: b?.[0]?.id || ""
        }));
      } catch (err) {
        notify(err instanceof Error ? err.message : "Failed to load HR data");
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => `${e.fullName} ${e.role?.name || ""} ${e.branch?.name || ""}`.toLowerCase().includes(q));
  }, [query, employees]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await apiPost("/hr/employees", {
        full_name: form.fullName,
        role_id: form.roleId,
        branch_id: form.branchId,
        department_id: form.departmentId,
        employment_type: form.employmentType,
        status: form.status,
        date_joined: form.dateJoined
      });
      setEmployees(await listEmployees());
      setOpen(false);
      setForm((p) => ({ ...p, fullName: "" }));
      notify("Employee created");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to create employee");
    }
  };

  const clockToggle = async (employeeId: string) => {
    const now = new Date().toISOString();
    await apiPost("/hr/attendance", { employee_id: employeeId, clock_in: now, status: "present" });
    notify("Attendance logged");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        description="Create employees, assign branch/role, and manage workforce records."
        action={
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white" onClick={() => setOpen(true)}>
            Create Employee
          </button>
        }
      />
      <HrNav />
      <div className="card p-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee, role, branch..." />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((employee) => (
          <EmployeeCard
            key={employee.id}
            employee={employee}
            departmentName={employee.department?.name || "Unassigned"}
            onClock={clockToggle}
          />
        ))}
      </div>

      <DrawerPanel open={open} title="Create Employee" onClose={() => setOpen(false)}>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="text-xs font-medium">Full Name</label>
            <input className="mt-1 w-full" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-medium">Assign Branch</label>
            <select className="mt-1 w-full" value={form.branchId} onChange={(e) => setForm({ ...form, branchId: e.target.value })}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Assign Role</label>
            <select className="mt-1 w-full" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Department</label>
            <select className="mt-1 w-full" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Employment Type</label>
            <select className="mt-1 w-full" value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
              <option value="full_time">Full time</option>
              <option value="part_time">Part time</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Date Joined</label>
            <input className="mt-1 w-full" type="date" value={form.dateJoined} onChange={(e) => setForm({ ...form, dateJoined: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
              Save Employee
            </button>
          </div>
        </form>
      </DrawerPanel>
    </div>
  );
}
