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

type Branch = { id: string; conceptId: string; name: string; timezone: string; currency: string };
type Concept = { id: string; name: string };

export default function BranchesPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Branch[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [form, setForm] = useState({ concept_id: "", name: "", timezone: "UTC", currency: "USD" });
  const [editing, setEditing] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const load = async () => {
    const [branchRows, conceptRows] = await Promise.all([apiGet("/branches"), apiGet("/concepts")]);
    setRows(branchRows || []);
    setConcepts(conceptRows || []);
    if (!form.concept_id && conceptRows?.length) {
      setForm((prev) => ({ ...prev, concept_id: conceptRows[0].id }));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await apiPost("/branches", form);
    setForm((prev) => ({ ...prev, name: "" }));
    await load();
    notify("Branch created");
    setOpenDrawer(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Branches"
        description="Configure your physical operating locations"
        action={
          <button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setOpenDrawer(true)}>
            Create Branch
          </button>
        }
      />

      {!rows.length ? (
        <EmptyState title="No branches yet" description="Create a branch for operations and device assignment." />
      ) : (
        <DataTable
          data={rows}
          columns={[
            { key: "name", header: "Name", render: (b) => b.name },
            { key: "timezone", header: "Timezone", render: (b) => b.timezone },
            { key: "currency", header: "Currency", render: (b) => b.currency },
            {
              key: "actions",
              header: "Actions",
              render: (b) => (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(b)} className="bg-slate-100 dark:bg-slate-800">
                    Edit
                  </button>
                  <button onClick={() => setDeleting(b)} className="bg-rose-100 text-rose-700 dark:bg-rose-500/20">
                    Delete
                  </button>
                </div>
              )
            }
          ]}
        />
      )}

      <FormModal open={!!editing} title="Edit Branch" onClose={() => setEditing(null)}>
        <p className="mb-3 text-sm text-slate-600">
          Backend edit endpoint is not available yet. This dialog is ready for integration.
        </p>
        <input
          value={editing?.name || ""}
          onChange={(e) => setEditing((prev) => (prev ? { ...prev, name: e.target.value } : null))}
        />
        <div className="mt-3">
          <button
            className="bg-brand-600 text-white"
            onClick={() => {
              if (!editing) return;
              setRows((prev) => prev.map((x) => (x.id === editing.id ? editing : x)));
              setEditing(null);
              notify("Branch updated");
            }}
          >
            Save
          </button>
        </div>
      </FormModal>
      <ConfirmDialog
        open={!!deleting}
        title="Delete Branch"
        description={`Confirm delete of ${deleting?.name || "this branch"}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setRows((prev) => prev.filter((x) => x.id !== deleting.id));
          setDeleting(null);
          notify("Branch removed");
        }}
      />
      <DrawerPanel open={openDrawer} title="Create Branch" onClose={() => setOpenDrawer(false)}>
        <form onSubmit={create} className="space-y-3">
          <select
            value={form.concept_id}
            onChange={(e) => setForm((prev) => ({ ...prev, concept_id: e.target.value }))}
            required
            className="w-full"
          >
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Branch name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            className="w-full"
          />
          <input
            placeholder="Timezone"
            value={form.timezone}
            onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
            required
            className="w-full"
          />
          <input
            placeholder="Currency"
            value={form.currency}
            onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
            required
            className="w-full"
          />
          <button className="w-full bg-indigo-600 text-white hover:bg-indigo-500">Create</button>
        </form>
      </DrawerPanel>
    </div>
  );
}
