"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AdvancedInventoryTable, InvColumn } from "@/components/inventory/advanced-table";
import { DrawerPanel } from "@/components/drawer-panel";
import { StatusBadge } from "@/components/inventory/status-badge";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };
type InvRow = { id: string; name: string; sku: string; stockLevel: unknown };
type TransferRow = {
  id: string;
  fromBranchId: string;
  toBranchId: string;
  quantity: unknown;
  status: string;
  createdAt: string;
  inventoryItem: { name: string; sku: string };
};

function num(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

export default function TransfersPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<InvRow[]>([]);
  const [open, setOpen] = useState(false);
  const [toBranchId, setToBranchId] = useState("");
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [status, setStatus] = useState<"draft" | "in_transit" | "completed">("draft");

  const load = useCallback(async () => {
    try {
      const data = (await apiGet("/inventory/transfers")) as TransferRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load transfers");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDrawer = async () => {
    setOpen(true);
    try {
      const [b, i] = await Promise.all([apiGet("/branches") as Promise<Branch[]>, apiGet("/inventory/items") as Promise<InvRow[]>]);
      setBranches(Array.isArray(b) ? b : []);
      setItems(Array.isArray(i) ? i : []);
      if (b?.[1]) setToBranchId(b[1].id);
      else if (b?.[0]) setToBranchId(b[0].id);
      if (i?.[0]) setInventoryItemId(i[0].id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load branches/items");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = parseFloat(quantity);
    if (!toBranchId || !inventoryItemId || !Number.isFinite(q) || q <= 0) {
      notify("Fill all fields");
      return;
    }
    try {
      await apiPost("/inventory/transfer", {
        to_branch_id: toBranchId,
        inventory_item_id: inventoryItemId,
        quantity: q,
        status
      });
      notify("Transfer recorded");
      setOpen(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Transfer failed — check branch SKU match");
    }
  };

  const columns: InvColumn<TransferRow>[] = [
    {
      key: "item",
      header: "Item",
      searchValue: (r) => `${r.inventoryItem?.name} ${r.inventoryItem?.sku}`,
      render: (r) => r.inventoryItem?.name ?? "—"
    },
    {
      key: "qty",
      header: "Qty",
      searchValue: (r) => String(num(r.quantity)),
      render: (r) => num(r.quantity).toFixed(2)
    },
    {
      key: "status",
      header: "Status",
      searchValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: "route",
      header: "From → To",
      defaultHidden: true,
      searchValue: (r) => `${r.fromBranchId} ${r.toBranchId}`,
      render: (r) => (
        <span className="font-mono text-[10px]">
          {r.fromBranchId.slice(0, 6)}… → {r.toBranchId.slice(0, 6)}…
        </span>
      )
    },
    {
      key: "when",
      header: "Created",
      defaultHidden: true,
      searchValue: (r) => r.createdAt,
      render: (r) => new Date(r.createdAt).toLocaleString()
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock transfers"
        description="Move stock between branches (destination item must share SKU)."
        action={
          <button type="button" className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => void openDrawer()}>
            New transfer
          </button>
        }
      />
      <AdvancedInventoryTable data={rows} columns={columns} getRowId={(r) => r.id} viewStorageKey="inv_xfer" />

      <DrawerPanel open={open} title="New transfer" onClose={() => setOpen(false)}>
        <form className="space-y-3 text-sm" onSubmit={submit}>
          <label className="text-xs font-medium">To branch</label>
          <select value={toBranchId} onChange={(e) => setToBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <label className="text-xs font-medium">Item (source branch)</label>
          <select value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)}>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} — on hand {num(it.stockLevel).toFixed(2)}
              </option>
            ))}
          </select>
          <label className="text-xs font-medium">Quantity</label>
          <input type="number" min={0.001} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <label className="text-xs font-medium">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="draft">Draft</option>
            <option value="in_transit">In transit</option>
            <option value="completed">Completed (moves stock)</option>
          </select>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="bg-slate-100 dark:bg-slate-800" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="bg-indigo-600 text-white">
              Submit
            </button>
          </div>
        </form>
      </DrawerPanel>
    </div>
  );
}
