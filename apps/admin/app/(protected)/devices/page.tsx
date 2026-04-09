"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { FormModal } from "@/components/form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";

type Device = { id: string; deviceName?: string; branchId: string; conceptId: string; status: string; deviceCode: string };
type Concept = { id: string; name: string };
type Branch = { id: string; name: string };

export default function DevicesPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Device[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [form, setForm] = useState({ concept_id: "", branch_id: "", device_name: "" });
  const [editing, setEditing] = useState<Device | null>(null);
  const [deleting, setDeleting] = useState<Device | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const load = async () => {
    const [deviceRows, conceptRows, branchRows] = await Promise.all([
      apiGet("/devices"),
      apiGet("/concepts"),
      apiGet("/branches")
    ]);
    setRows(deviceRows || []);
    setConcepts(conceptRows || []);
    setBranches(branchRows || []);
    if (!form.concept_id && conceptRows?.length) {
      setForm((prev) => ({ ...prev, concept_id: conceptRows[0].id }));
    }
    if (!form.branch_id && branchRows?.length) {
      setForm((prev) => ({ ...prev, branch_id: branchRows[0].id }));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await apiPost("/devices/register", form);
    setForm((prev) => ({ ...prev, device_name: "" }));
    await load();
    notify("Device registered");
    setOpenDrawer(false);
  };

  const toggleStatus = async (row: Device) => {
    const endpoint = row.status === "active" ? `/devices/${row.id}/block` : `/devices/${row.id}/unblock`;
    await apiPost(endpoint, {});
    await load();
    notify(row.status === "active" ? "Device blocked" : "Device unblocked");
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Devices"
        description="Register and control POS devices"
        action={
          <button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setOpenDrawer(true)}>
            Register Device
          </button>
        }
      />
      {!rows.length ? (
        <EmptyState title="No devices yet" description="Register your first POS device for this tenant." />
      ) : (
        <DataTable
          data={rows}
          columns={[
            { key: "name", header: "Name", render: (d) => d.deviceName || "-" },
            { key: "code", header: "Device Code", render: (d) => d.deviceCode },
            { key: "status", header: "Status", render: (d) => d.status },
            {
              key: "actions",
              header: "Actions",
              render: (d) => (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(d)} className="bg-slate-100 dark:bg-slate-800">
                    Edit
                  </button>
                  <button onClick={() => void toggleStatus(d)} className="bg-amber-100 text-amber-800 dark:bg-amber-500/20">
                    {d.status === "active" ? "Block" : "Unblock"}
                  </button>
                  <button onClick={() => setDeleting(d)} className="bg-rose-100 text-rose-700 dark:bg-rose-500/20">
                    Delete
                  </button>
                </div>
              )
            }
          ]}
        />
      )}

      <FormModal open={!!editing} title="Edit Device" onClose={() => setEditing(null)}>
        <p className="mb-3 text-sm text-slate-600">
          Backend edit endpoint is not available yet. This dialog is ready for integration.
        </p>
        <input
          value={editing?.deviceName || ""}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, deviceName: e.target.value } : null))}
        />
        <div className="mt-3">
          <button
            className="bg-brand-600 text-white"
            onClick={() => {
              if (!editing) return;
              setRows((prev) => prev.map((x) => (x.id === editing.id ? editing : x)));
              setEditing(null);
              notify("Device updated");
            }}
          >
            Save
          </button>
        </div>
      </FormModal>
      <ConfirmDialog
        open={!!deleting}
        title="Delete Device"
        description={`Confirm delete of ${deleting?.deviceName || deleting?.deviceCode || "this device"}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setRows((prev) => prev.filter((x) => x.id !== deleting.id));
          setDeleting(null);
          notify("Device removed");
        }}
      />
      <DrawerPanel open={openDrawer} title="Register Device" onClose={() => setOpenDrawer(false)}>
        <form onSubmit={create} className="space-y-3">
          <select
            value={form.concept_id}
            onChange={(e) => setForm((prev) => ({ ...prev, concept_id: e.target.value }))}
            className="w-full"
          >
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={form.branch_id}
            onChange={(e) => setForm((prev) => ({ ...prev, branch_id: e.target.value }))}
            className="w-full"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Device name"
            value={form.device_name}
            onChange={(e) => setForm((prev) => ({ ...prev, device_name: e.target.value }))}
            required
            className="w-full"
          />
          <button className="w-full bg-indigo-600 text-white hover:bg-indigo-500">Register</button>
        </form>
      </DrawerPanel>
    </div>
  );
}
