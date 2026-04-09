"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AdvancedInventoryTable, InvColumn } from "@/components/inventory/advanced-table";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";

type InvRow = { id: string; name: string; sku: string; stockLevel: unknown };
type WasteRow = {
  id: string;
  quantity: unknown;
  reason: string;
  createdBy: string;
  createdAt: string;
  inventoryItem: { name: string };
};

function num(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

export default function WastagePage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<WasteRow[]>([]);
  const [items, setItems] = useState<InvRow[]>([]);
  const [open, setOpen] = useState(false);
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const data = (await apiGet("/inventory/wastage")) as WasteRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load wastage");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDrawer = async () => {
    setOpen(true);
    try {
      const i = (await apiGet("/inventory/items")) as InvRow[];
      setItems(Array.isArray(i) ? i : []);
      if (i?.[0]) setInventoryItemId(i[0].id);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load items");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = parseFloat(quantity);
    if (!inventoryItemId || !reason.trim() || !Number.isFinite(q) || q <= 0) {
      notify("Item, quantity, and reason required");
      return;
    }
    try {
      await apiPost("/inventory/wastage", {
        inventory_item_id: inventoryItemId,
        quantity: q,
        reason: reason.trim(),
        created_by: "admin_ui"
      });
      notify("Wastage recorded");
      setReason("");
      setOpen(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const columns: InvColumn<WasteRow>[] = [
    {
      key: "item",
      header: "Item",
      searchValue: (r) => r.inventoryItem?.name ?? "",
      render: (r) => r.inventoryItem?.name ?? "—"
    },
    {
      key: "qty",
      header: "Qty",
      searchValue: (r) => String(num(r.quantity)),
      render: (r) => num(r.quantity).toFixed(2)
    },
    {
      key: "reason",
      header: "Reason",
      searchValue: (r) => r.reason,
      render: (r) => r.reason
    },
    {
      key: "by",
      header: "Recorded by",
      defaultHidden: true,
      searchValue: (r) => r.createdBy,
      render: (r) => r.createdBy
    },
    {
      key: "when",
      header: "When",
      defaultHidden: true,
      searchValue: (r) => r.createdAt,
      render: (r) => new Date(r.createdAt).toLocaleString()
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Wastage"
        description="Spoilage and write-offs for this branch."
        action={
          <button type="button" className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => void openDrawer()}>
            Log wastage
          </button>
        }
      />
      <AdvancedInventoryTable data={rows} columns={columns} getRowId={(r) => r.id} viewStorageKey="inv_waste" />

      <DrawerPanel open={open} title="Log wastage" onClose={() => setOpen(false)}>
        <form className="space-y-3 text-sm" onSubmit={submit}>
          <label className="text-xs font-medium">Item</label>
          <select value={inventoryItemId} onChange={(e) => setInventoryItemId(e.target.value)}>
            {items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.name} ({num(it.stockLevel).toFixed(2)} on hand)
              </option>
            ))}
          </select>
          <label className="text-xs font-medium">Quantity</label>
          <input type="number" min={0.001} step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <label className="text-xs font-medium">Reason</label>
          <textarea
            className="min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
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
