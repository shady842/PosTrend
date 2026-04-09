"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AdvancedInventoryTable, InvColumn } from "@/components/inventory/advanced-table";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";
type Uom = { id: string; name: string; symbol?: string };
type InvRow = {
  id: string;
  name: string;
  sku: string;
  stockLevel: unknown;
  reorderPoint: unknown;
  uom: Uom | null;
};

function num(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

export default function InventoryItemsPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<InvRow[]>([]);
  const [open, setOpen] = useState(false);
  const [uoms, setUoms] = useState<Uom[]>([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [uomId, setUomId] = useState("");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [stockLevel, setStockLevel] = useState("0");
  const [conceptWide, setConceptWide] = useState(false);

  const loadUoms = useCallback(async () => {
    try {
      const data = (await apiGet("/inventory/uoms")) as { id: string; name: string }[];
      setUoms(Array.isArray(data) ? data : []);
    } catch {
      setUoms([]);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const data = (await apiGet("/inventory/items")) as InvRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load items");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void loadUoms();
  }, [open, loadUoms]);

  const resetForm = () => {
    setName("");
    setSku("");
    setUomId("");
    setReorderPoint("0");
    setStockLevel("0");
    setConceptWide(false);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    const s = sku.trim();
    if (!n || !s) {
      notify("Name and SKU are required");
      return;
    }
    const rp = parseFloat(reorderPoint);
    const sl = parseFloat(stockLevel);
    if (Number.isNaN(rp) || rp < 0 || Number.isNaN(sl) || sl < 0) {
      notify("Reorder point and on-hand must be valid numbers ≥ 0");
      return;
    }
    try {
      await apiPost("/inventory/items", {
        name: n,
        sku: s,
        uom_id: uomId || undefined,
        reorder_point: rp,
        stock_level: sl,
        concept_wide: conceptWide
      });
      notify("Item created");
      resetForm();
      setOpen(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to create item");
    }
  };

  const columns: InvColumn<InvRow>[] = [
    {
      key: "name",
      header: "Item",
      searchValue: (r) => `${r.name} ${r.sku}`,
      render: (r) => <span className="font-medium">{r.name}</span>
    },
    {
      key: "sku",
      header: "SKU",
      searchValue: (r) => r.sku,
      render: (r) => <code className="text-xs">{r.sku}</code>
    },
    {
      key: "stock",
      header: "On hand",
      searchValue: (r) => String(num(r.stockLevel)),
      render: (r) => num(r.stockLevel).toFixed(2)
    },
    {
      key: "reorder",
      header: "Reorder pt.",
      defaultHidden: true,
      searchValue: (r) => String(num(r.reorderPoint)),
      render: (r) => num(r.reorderPoint).toFixed(2)
    },
    {
      key: "uom",
      header: "UOM",
      defaultHidden: true,
      searchValue: (r) => r.uom?.name ?? "",
      render: (r) => r.uom?.symbol || r.uom?.name || "—"
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Inventory items"
        description="Catalog of ingredients and stock-tracked products for this concept."
        action={
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            onClick={() => setOpen(true)}
          >
            Add item
          </button>
        }
      />
      <AdvancedInventoryTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        viewStorageKey="inv_items"
        searchPlaceholder="Search name or SKU…"
        rowClassName={(r) =>
          num(r.stockLevel) <= num(r.reorderPoint) && num(r.reorderPoint) > 0
            ? "bg-rose-50/80 dark:bg-rose-950/25"
            : undefined
        }
        bulkActions={[
          {
            id: "copy",
            label: "Copy SKUs",
            onClick: (ids) => {
              const skus = rows.filter((r) => ids.includes(r.id)).map((r) => r.sku);
              void navigator.clipboard.writeText(skus.join("\n"));
              notify(`${skus.length} SKUs copied`);
            }
          }
        ]}
      />

      <DrawerPanel
        open={open}
        title="New inventory item"
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
      >
        <form className="space-y-3" onSubmit={create}>
          <div>
            <label className="text-xs font-medium">Name</label>
            <input className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium">SKU</label>
            <input className="mt-1 w-full" value={sku} onChange={(e) => setSku(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-medium">Unit of measure</label>
            <select className="mt-1 w-full" value={uomId} onChange={(e) => setUomId(e.target.value)}>
              <option value="">None</option>
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">On hand (initial)</label>
            <input
              className="mt-1 w-full"
              type="number"
              min={0}
              step="any"
              value={stockLevel}
              onChange={(e) => setStockLevel(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium">Reorder point</label>
            <input
              className="mt-1 w-full"
              type="number"
              min={0}
              step="any"
              value={reorderPoint}
              onChange={(e) => setReorderPoint(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={conceptWide} onChange={(e) => setConceptWide(e.target.checked)} />
            All branches (concept-wide)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Leave unchecked to scope this item to the branch selected in the header.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
              Create
            </button>
          </div>
        </form>
      </DrawerPanel>
    </div>
  );
}
