"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { FormModal } from "@/components/form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";

type UserRow = { id: string; fullName: string; email: string; role: string; status?: string };

export default function UsersPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "ChangeMe123!",
    roleId: "",
    departmentId: "",
    branchId: ""
  });
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const load = async () => {
    const [users, roleRows, depRows, branchRows] = await Promise.all([
      apiGet("/users"),
      apiGet("/hr/roles"),
      apiGet("/hr/departments"),
      apiGet("/branches")
    ]);
    setRows(Array.isArray(users) ? users : []);
    const rs = Array.isArray(roleRows) ? roleRows : [];
    const ds = Array.isArray(depRows) ? depRows : [];
    const bs = Array.isArray(branchRows) ? branchRows : [];
    setRoles(rs);
    setDepartments(ds);
    setBranches(bs);
    setForm((prev) => ({
      ...prev,
      roleId: prev.roleId || rs[0]?.id || "",
      departmentId: prev.departmentId || ds[0]?.id || "",
      branchId: prev.branchId || bs[0]?.id || ""
    }));
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await apiPost("/users", {
      full_name: form.fullName,
      email: form.email,
      password: form.password,
      role_id: form.roleId,
      department_id: form.departmentId || undefined,
      branch_id: form.branchId || undefined
    });
    await load();
    setForm((prev) => ({ ...prev, fullName: "", email: "", password: "ChangeMe123!" }));
    setOpenDrawer(false);
    notify("User created with linked employee record");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Manage tenant users with unified employee creation"
        action={
          <button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setOpenDrawer(true)}>
            Create User
          </button>
        }
      />
      <DataTable
        data={rows}
        columns={[
          { key: "name", header: "Name", render: (u) => u.fullName },
          { key: "email", header: "Email", render: (u) => u.email },
          { key: "role", header: "Role", render: (u) => u.role },
          { key: "status", header: "Status", render: (u) => u.status || "active" },
          {
            key: "actions",
            header: "Actions",
            render: (u) => (
              <div className="flex gap-2">
                <button onClick={() => setEditing(u)} className="bg-slate-100 dark:bg-slate-800">
                  Edit
                </button>
                <button onClick={() => setDeleting(u)} className="bg-rose-100 text-rose-700 dark:bg-rose-500/20">
                  Delete
                </button>
              </div>
            )
          }
        ]}
      />

      <FormModal open={!!editing} title="Edit User" onClose={() => setEditing(null)}>
        <input
          className="mb-2 w-full"
          value={editing?.fullName || ""}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, fullName: e.target.value } : null))}
        />
        <input
          className="mb-2 w-full"
          value={editing?.email || ""}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, email: e.target.value } : null))}
        />
        <select
          className="w-full"
          value={editing?.role || "manager"}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, role: e.target.value } : null))}
        >
          <option value="manager">Manager</option>
          <option value="cashier">Cashier</option>
          <option value="admin">Admin</option>
        </select>
        <div className="mt-3">
          <button
            className="bg-brand-600 text-white"
            onClick={async () => {
              if (!editing) return;
              await apiPatch(`/users/${editing.id}`, {
                full_name: editing.fullName,
                email: editing.email
              });
              await load();
              setEditing(null);
              notify("User updated");
            }}
          >
            Save
          </button>
        </div>
      </FormModal>

      <ConfirmDialog
        open={!!deleting}
        title="Delete User"
        description={`Confirm delete of ${deleting?.fullName || "this user"}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await apiPost(`/users/${deleting.id}/deactivate`, {});
          await load();
          setDeleting(null);
          notify("User deactivated");
        }}
      />
      <DrawerPanel open={openDrawer} title="Create User" onClose={() => setOpenDrawer(false)}>
        <form onSubmit={create} className="space-y-3">
          <input
            placeholder="Full name"
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
            required
            className="w-full"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            required
            className="w-full"
          />
          <input
            type="text"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
            required
            className="w-full"
          />
          <select value={form.roleId} onChange={(e) => setForm((prev) => ({ ...prev, roleId: e.target.value }))} className="w-full">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <select value={form.departmentId} onChange={(e) => setForm((prev) => ({ ...prev, departmentId: e.target.value }))} className="w-full">
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select value={form.branchId} onChange={(e) => setForm((prev) => ({ ...prev, branchId: e.target.value }))} className="w-full">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button className="w-full bg-indigo-600 text-white hover:bg-indigo-500">Create</button>
        </form>
      </DrawerPanel>
    </div>
  );
}
