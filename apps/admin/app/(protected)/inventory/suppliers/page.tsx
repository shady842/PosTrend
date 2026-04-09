"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AdvancedInventoryTable, InvColumn } from "@/components/inventory/advanced-table";
import { DrawerPanel } from "@/components/drawer-panel";
import { StatusBadge } from "@/components/inventory/status-badge";
import { useToast } from "@/components/toast";

type SupplierRow = {
  id: string;
  name: string;
  status: string;
  _count?: { purchaseOrders: number };
};

export default function SuppliersPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      const data = (await apiGet("/suppliers")) as SupplierRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load suppliers");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await apiPost("/suppliers", { name: name.trim() });
      setName("");
      setOpen(false);
      notify("Supplier created");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const columns: InvColumn<SupplierRow>[] = [
    {
      key: "name",
      header: "Name",
      searchValue: (r) => r.name,
      render: (r) => <span className="font-medium">{r.name}</span>
    },
    {
      key: "status",
      header: "Status",
      searchValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: "pos",
      header: "PO count",
      defaultHidden: true,
      searchValue: (r) => String(r._count?.purchaseOrders ?? 0),
      render: (r) => String(r._count?.purchaseOrders ?? 0)
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Suppliers"
        description="Vendors linked to your tenant for purchasing."
        action={
          <button type="button" className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setOpen(true)}>
            Add supplier
          </button>
        }
      />
      <AdvancedInventoryTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        viewStorageKey="inv_suppliers"
        searchPlaceholder="Search suppliers…"
      />

      <DrawerPanel open={open} title="New supplier" onClose={() => setOpen(false)}>
        <form className="space-y-3" onSubmit={create}>
          <label className="text-xs font-medium">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="bg-slate-100 dark:bg-slate-800" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="bg-indigo-600 text-white">
              Create
            </button>
          </div>
        </form>
      </DrawerPanel>
    </div>
  );
}
