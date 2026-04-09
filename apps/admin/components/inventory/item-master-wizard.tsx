"use client";

import { useMemo, useState } from "react";

type StepKey = "basic" | "uom" | "pricing" | "suppliers" | "stock" | "recipe" | "accounting";

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "basic", label: "Basic" },
  { key: "uom", label: "UOM" },
  { key: "pricing", label: "Pricing" },
  { key: "suppliers", label: "Suppliers" },
  { key: "stock", label: "Stock Rules" },
  { key: "recipe", label: "Recipe" },
  { key: "accounting", label: "Accounting" }
];

type Props = {
  onSubmit: (payload: Record<string, unknown>) => Promise<void> | void;
};

export function ItemMasterWizard({ onSubmit }: Props) {
  const [idx, setIdx] = useState(0);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    itemType: "inventory",
    trackStock: true,
    allowNegative: false,
    batchTracking: false,
    expiryTracking: false,
    baseUom: "",
    purchaseUom: "",
    recipeUom: "",
    salesUom: "",
    purchaseToBase: "1",
    recipeToBase: "1",
    salesToBase: "1",
    conceptPrice: "0",
    branchPrice: "0",
    takeawayPrice: "0",
    deliveryPrice: "0",
    happyHourPrice: "0",
    primarySupplier: "",
    secondarySuppliers: "",
    supplierSku: "",
    purchasePrice: "0",
    leadTimeDays: "0",
    parLevel: "0",
    reorderLevel: "0",
    minLevel: "0",
    maxLevel: "0",
    recipeJson: "[]",
    inventoryAccount: "1200-INVENTORY",
    cogsAccount: "5000-COGS",
    wastageAccount: "5200-WASTAGE"
  });

  const active = steps[idx];
  const percent = useMemo(() => Math.round(((idx + 1) / steps.length) * 100), [idx]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span>Item creation wizard</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 rounded bg-slate-100 dark:bg-slate-800">
          <div className="h-2 rounded bg-indigo-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`rounded-lg px-3 py-1 text-xs ${i === idx ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"}`}
            onClick={() => setIdx(i)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {active.key === "basic" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          <select value={form.itemType} onChange={(e) => setForm({ ...form, itemType: e.target.value })}>
            <option value="inventory">Inventory item</option>
            <option value="recipe">Recipe item</option>
            <option value="sub_recipe">Sub recipe</option>
            <option value="service">Service item</option>
            <option value="modifier">Modifier item</option>
            <option value="production">Production item</option>
          </select>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.trackStock} onChange={(e) => setForm({ ...form, trackStock: e.target.checked })} />Track stock</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.allowNegative} onChange={(e) => setForm({ ...form, allowNegative: e.target.checked })} />Allow negative</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.batchTracking} onChange={(e) => setForm({ ...form, batchTracking: e.target.checked })} />Batch tracking</label>
            <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.expiryTracking} onChange={(e) => setForm({ ...form, expiryTracking: e.target.checked })} />Expiry tracking</label>
          </div>
        </div>
      ) : null}

      {active.key === "uom" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <input placeholder="Base UOM" value={form.baseUom} onChange={(e) => setForm({ ...form, baseUom: e.target.value })} />
          <input placeholder="Purchase UOM" value={form.purchaseUom} onChange={(e) => setForm({ ...form, purchaseUom: e.target.value })} />
          <input placeholder="Recipe UOM" value={form.recipeUom} onChange={(e) => setForm({ ...form, recipeUom: e.target.value })} />
          <input placeholder="Sales UOM" value={form.salesUom} onChange={(e) => setForm({ ...form, salesUom: e.target.value })} />
          <input placeholder="Purchase->Base ratio" value={form.purchaseToBase} onChange={(e) => setForm({ ...form, purchaseToBase: e.target.value })} />
          <input placeholder="Recipe->Base ratio" value={form.recipeToBase} onChange={(e) => setForm({ ...form, recipeToBase: e.target.value })} />
          <input placeholder="Sales->Base ratio" value={form.salesToBase} onChange={(e) => setForm({ ...form, salesToBase: e.target.value })} />
        </div>
      ) : null}

      {active.key === "pricing" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <input placeholder="Concept price" type="number" value={form.conceptPrice} onChange={(e) => setForm({ ...form, conceptPrice: e.target.value })} />
          <input placeholder="Branch price" type="number" value={form.branchPrice} onChange={(e) => setForm({ ...form, branchPrice: e.target.value })} />
          <input placeholder="Takeaway price" type="number" value={form.takeawayPrice} onChange={(e) => setForm({ ...form, takeawayPrice: e.target.value })} />
          <input placeholder="Delivery price" type="number" value={form.deliveryPrice} onChange={(e) => setForm({ ...form, deliveryPrice: e.target.value })} />
          <input placeholder="Happy hour price" type="number" value={form.happyHourPrice} onChange={(e) => setForm({ ...form, happyHourPrice: e.target.value })} />
        </div>
      ) : null}

      {active.key === "suppliers" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <input placeholder="Primary supplier ID" value={form.primarySupplier} onChange={(e) => setForm({ ...form, primarySupplier: e.target.value })} />
          <input placeholder="Secondary supplier IDs (comma)" value={form.secondarySuppliers} onChange={(e) => setForm({ ...form, secondarySuppliers: e.target.value })} />
          <input placeholder="Supplier SKU" value={form.supplierSku} onChange={(e) => setForm({ ...form, supplierSku: e.target.value })} />
          <input placeholder="Purchase price" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} />
          <input placeholder="Lead time days" type="number" value={form.leadTimeDays} onChange={(e) => setForm({ ...form, leadTimeDays: e.target.value })} />
        </div>
      ) : null}

      {active.key === "stock" ? (
        <div className="grid gap-3 md:grid-cols-4">
          <input placeholder="Par level" type="number" value={form.parLevel} onChange={(e) => setForm({ ...form, parLevel: e.target.value })} />
          <input placeholder="Reorder level" type="number" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          <input placeholder="Min level" type="number" value={form.minLevel} onChange={(e) => setForm({ ...form, minLevel: e.target.value })} />
          <input placeholder="Max level" type="number" value={form.maxLevel} onChange={(e) => setForm({ ...form, maxLevel: e.target.value })} />
        </div>
      ) : null}

      {active.key === "recipe" ? (
        <div className="space-y-2">
          <p className="muted text-xs">Recipe / sub-recipe JSON lines (inventory_item_id, qty, uom, yield_pct, waste_pct)</p>
          <textarea className="w-full" rows={8} value={form.recipeJson} onChange={(e) => setForm({ ...form, recipeJson: e.target.value })} />
        </div>
      ) : null}

      {active.key === "accounting" ? (
        <div className="grid gap-3 md:grid-cols-3">
          <input placeholder="Inventory account" value={form.inventoryAccount} onChange={(e) => setForm({ ...form, inventoryAccount: e.target.value })} />
          <input placeholder="COGS account" value={form.cogsAccount} onChange={(e) => setForm({ ...form, cogsAccount: e.target.value })} />
          <input placeholder="Wastage account" value={form.wastageAccount} onChange={(e) => setForm({ ...form, wastageAccount: e.target.value })} />
        </div>
      ) : null}

      <div className="flex justify-between">
        <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800" disabled={idx === 0} onClick={() => setIdx((i) => Math.max(0, i - 1))}>
          Back
        </button>
        {idx < steps.length - 1 ? (
          <button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}>
            Next
          </button>
        ) : (
          <button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => void onSubmit(form)}>
            Create enterprise item
          </button>
        )}
      </div>
    </div>
  );
}
