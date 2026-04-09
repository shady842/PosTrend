"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { FormModal } from "@/components/form-modal";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageHeader } from "@/components/page-header";
import { useToast } from "@/components/toast";
import { DrawerPanel } from "@/components/drawer-panel";

type Concept = { id: string; name: string; createdAt?: string };

export default function ConceptsPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Concept[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Concept | null>(null);
  const [deleting, setDeleting] = useState<Concept | null>(null);
  const [openDrawer, setOpenDrawer] = useState(false);

  const load = async () => {
    const data = await apiGet("/concepts");
    setRows(data || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await apiPost("/concepts", { name });
    setName("");
    await load();
    notify("Concept created");
    setOpenDrawer(false);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Concepts"
        description="Manage your brands and concepts"
        action={
          <button className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setOpenDrawer(true)}>
            Create Concept
          </button>
        }
      />
      {!rows.length ? (
        <EmptyState title="No concepts yet" description="Create your first concept to organize branches." />
      ) : (
        <DataTable
          data={rows}
          columns={[
            { key: "name", header: "Name", render: (c) => c.name },
            {
              key: "actions",
              header: "Actions",
              render: (c) => (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(c)} className="bg-slate-100 dark:bg-slate-800">
                    Edit
                  </button>
                  <button onClick={() => setDeleting(c)} className="bg-rose-100 text-rose-700 dark:bg-rose-500/20">
                    Delete
                  </button>
                </div>
              )
            }
          ]}
        />
      )}

      <FormModal open={!!editing} title="Edit Concept" onClose={() => setEditing(null)}>
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
              notify("Concept updated");
            }}
          >
            Save
          </button>
        </div>
      </FormModal>
      <ConfirmDialog
        open={!!deleting}
        title="Delete Concept"
        description={`Confirm delete of ${deleting?.name || "this concept"}?`}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          setRows((prev) => prev.filter((x) => x.id !== deleting.id));
          setDeleting(null);
          notify("Concept removed");
        }}
      />
      <DrawerPanel open={openDrawer} title="Create Concept" onClose={() => setOpenDrawer(false)}>
        <form onSubmit={create} className="space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Concept name" required className="w-full" />
          <button className="w-full bg-indigo-600 text-white hover:bg-indigo-500">Create</button>
        </form>
      </DrawerPanel>
    </div>
  );
}
