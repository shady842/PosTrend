"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

export type AdvancedMenuCreatePayload = {
  category_id: string;
  name: string;
  description: string;
  sku: string;
  barcode: string;
  image_url: string;
  is_active: boolean;
  is_recipe_item: boolean;
  track_inventory: boolean;
  base_price: number;
  price_takeaway: number;
  price_delivery: number;
  tax_profile: string;
  kitchen_station_id: string;
  branch_price_overrides: { branch_id: string; dine_in: number; takeaway: number; delivery: number }[];
  variants: { name: string; price_override: number }[];
  modifier_group_ids: string[];
  recipe_ingredients: { item_name: string; qty: number; uom: string; unit_cost: number }[];
  inventory: { par_level: number; reorder_level: number; allow_negative: boolean };
  accounting: { sales_account: string; cogs_account: string; inventory_account: string; tax_account: string };
};

type Props = {
  categories: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; name: string }>;
  modifierGroups: Array<{ id: string; name: string }>;
  initialValues?: Partial<AdvancedMenuCreatePayload>;
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (payload: AdvancedMenuCreatePayload) => Promise<void>;
};

const tabs = ["General", "Pricing", "Variants", "Modifiers", "Recipe", "Inventory", "Kitchen", "Accounting"] as const;
type TabKey = (typeof tabs)[number];

function toNum(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function AdvancedItemCreateForm({
  categories,
  branches,
  modifierGroups,
  initialValues,
  submitLabel,
  onCancel,
  onSubmit
}: Props) {
  const [tab, setTab] = useState<TabKey>("General");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category_id: initialValues?.category_id || categories[0]?.id || "",
    name: initialValues?.name || "",
    description: initialValues?.description || "",
    sku: initialValues?.sku || "",
    barcode: initialValues?.barcode || "",
    image_url: initialValues?.image_url || "",
    is_active: initialValues?.is_active ?? true,
    is_recipe_item: initialValues?.is_recipe_item ?? false,
    track_inventory: initialValues?.track_inventory ?? false,
    price_dine_in: String(initialValues?.base_price ?? 0),
    price_takeaway: String(initialValues?.price_takeaway ?? 0),
    price_delivery: String(initialValues?.price_delivery ?? 0),
    tax_profile: initialValues?.tax_profile || "default",
    kitchen_station_id: initialValues?.kitchen_station_id || "hot",
    sales_account: initialValues?.accounting?.sales_account || "4000-SALES",
    cogs_account: initialValues?.accounting?.cogs_account || "5000-COGS",
    inventory_account: initialValues?.accounting?.inventory_account || "1200-INVENTORY",
    tax_account: initialValues?.accounting?.tax_account || "2100-VAT-PAYABLE",
    par_level: String(initialValues?.inventory?.par_level ?? 0),
    reorder_level: String(initialValues?.inventory?.reorder_level ?? 0),
    allow_negative: initialValues?.inventory?.allow_negative ?? false
  });
  const [branchPricing, setBranchPricing] = useState<Array<{ branch_id: string; dine_in: string; takeaway: string; delivery: string }>>(
    (initialValues?.branch_price_overrides || []).map((b) => ({
      branch_id: b.branch_id,
      dine_in: String(b.dine_in ?? 0),
      takeaway: String(b.takeaway ?? 0),
      delivery: String(b.delivery ?? 0)
    }))
  );
  const [variants, setVariants] = useState<Array<{ name: string; price_override: string }>>(
    (initialValues?.variants || []).map((v) => ({ name: v.name, price_override: String(v.price_override ?? 0) }))
  );
  const [modifierGroupIds, setModifierGroupIds] = useState<string[]>(initialValues?.modifier_group_ids || []);
  const [recipeLines, setRecipeLines] = useState<Array<{ item_name: string; qty: string; uom: string; unit_cost: string }>>(
    (initialValues?.recipe_ingredients || []).map((r) => ({
      item_name: r.item_name,
      qty: String(r.qty ?? 0),
      uom: r.uom || "unit",
      unit_cost: String(r.unit_cost ?? 0)
    }))
  );

  useEffect(() => {
    if (!initialValues) return;
    setForm({
      category_id: initialValues.category_id || categories[0]?.id || "",
      name: initialValues.name || "",
      description: initialValues.description || "",
      sku: initialValues.sku || "",
      barcode: initialValues.barcode || "",
      image_url: initialValues.image_url || "",
      is_active: initialValues.is_active ?? true,
      is_recipe_item: initialValues.is_recipe_item ?? false,
      track_inventory: initialValues.track_inventory ?? false,
      price_dine_in: String(initialValues.base_price ?? 0),
      price_takeaway: String(initialValues.price_takeaway ?? 0),
      price_delivery: String(initialValues.price_delivery ?? 0),
      tax_profile: initialValues.tax_profile || "default",
      kitchen_station_id: initialValues.kitchen_station_id || "hot",
      sales_account: initialValues.accounting?.sales_account || "4000-SALES",
      cogs_account: initialValues.accounting?.cogs_account || "5000-COGS",
      inventory_account: initialValues.accounting?.inventory_account || "1200-INVENTORY",
      tax_account: initialValues.accounting?.tax_account || "2100-VAT-PAYABLE",
      par_level: String(initialValues.inventory?.par_level ?? 0),
      reorder_level: String(initialValues.inventory?.reorder_level ?? 0),
      allow_negative: initialValues.inventory?.allow_negative ?? false
    });
    setBranchPricing(
      (initialValues.branch_price_overrides || []).map((b) => ({
        branch_id: b.branch_id,
        dine_in: String(b.dine_in ?? 0),
        takeaway: String(b.takeaway ?? 0),
        delivery: String(b.delivery ?? 0)
      }))
    );
    setVariants((initialValues.variants || []).map((v) => ({ name: v.name, price_override: String(v.price_override ?? 0) })));
    setModifierGroupIds(initialValues.modifier_group_ids || []);
    setRecipeLines(
      (initialValues.recipe_ingredients || []).map((r) => ({
        item_name: r.item_name,
        qty: String(r.qty ?? 0),
        uom: r.uom || "unit",
        unit_cost: String(r.unit_cost ?? 0)
      }))
    );
  }, [initialValues, categories]);

  const canSubmit = useMemo(() => Boolean(form.category_id && form.name.trim()), [form.category_id, form.name]);

  const onImageUpload = (file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, image_url: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      await onSubmit({
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description,
        sku: form.sku,
        barcode: form.barcode,
        image_url: form.image_url,
        is_active: form.is_active,
        is_recipe_item: form.is_recipe_item,
        track_inventory: form.track_inventory,
        base_price: toNum(form.price_dine_in),
        price_takeaway: toNum(form.price_takeaway),
        price_delivery: toNum(form.price_delivery),
        tax_profile: form.tax_profile,
        kitchen_station_id: form.kitchen_station_id,
        branch_price_overrides: branchPricing.map((b) => ({
          branch_id: b.branch_id,
          dine_in: toNum(b.dine_in),
          takeaway: toNum(b.takeaway),
          delivery: toNum(b.delivery)
        })),
        variants: variants
          .filter((v) => v.name.trim())
          .map((v) => ({ name: v.name.trim(), price_override: toNum(v.price_override) })),
        modifier_group_ids: modifierGroupIds,
        recipe_ingredients: recipeLines
          .filter((r) => r.item_name.trim())
          .map((r) => ({
            item_name: r.item_name.trim(),
            qty: toNum(r.qty),
            uom: r.uom || "unit",
            unit_cost: toNum(r.unit_cost)
          })),
        inventory: {
          par_level: toNum(form.par_level),
          reorder_level: toNum(form.reorder_level),
          allow_negative: form.allow_negative
        },
        accounting: {
          sales_account: form.sales_account,
          cogs_account: form.cogs_account,
          inventory_account: form.inventory_account,
          tax_account: form.tax_account
        }
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={tab === t ? "bg-indigo-600 text-white" : "bg-slate-100 dark:bg-slate-800"}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "General" ? (
        <div className="grid gap-3">
          <label className="text-xs font-medium">Category</label>
          <select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="text-xs font-medium">Item name</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          <label className="text-xs font-medium">Description</label>
          <textarea className="min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium">SKU</label>
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Barcode</label>
              <input value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} />
            </div>
          </div>
          <label className="text-xs font-medium">Image URL</label>
          <input value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
          <input type="file" accept="image/*" className="text-xs" onChange={(e) => onImageUpload(e.target.files?.[0] ?? null)} />
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.is_recipe_item} onChange={(e) => setForm((f) => ({ ...f, is_recipe_item: e.target.checked }))} />
            Recipe item
          </label>
          <label className="inline-flex items-center gap-2 text-xs">
            <input type="checkbox" checked={form.track_inventory} onChange={(e) => setForm((f) => ({ ...f, track_inventory: e.target.checked }))} />
            Track inventory
          </label>
        </div>
      ) : null}

      {tab === "Pricing" ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="text-xs font-medium">Dine-in</label><input type="number" min={0} step="0.01" value={form.price_dine_in} onChange={(e) => setForm((f) => ({ ...f, price_dine_in: e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Takeaway</label><input type="number" min={0} step="0.01" value={form.price_takeaway} onChange={(e) => setForm((f) => ({ ...f, price_takeaway: e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Delivery</label><input type="number" min={0} step="0.01" value={form.price_delivery} onChange={(e) => setForm((f) => ({ ...f, price_delivery: e.target.value }))} /></div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <div className="mb-2 text-xs font-semibold uppercase text-slate-500">Branch price override</div>
            <div className="space-y-2">
              {branchPricing.map((r, idx) => (
                <div key={`${r.branch_id}-${idx}`} className="grid gap-2 sm:grid-cols-5">
                  <select value={r.branch_id} onChange={(e) => setBranchPricing((prev) => prev.map((x, i) => (i === idx ? { ...x, branch_id: e.target.value } : x)))}>
                    <option value="">Branch</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                  <input type="number" min={0} step="0.01" placeholder="Dine-in" value={r.dine_in} onChange={(e) => setBranchPricing((prev) => prev.map((x, i) => (i === idx ? { ...x, dine_in: e.target.value } : x)))} />
                  <input type="number" min={0} step="0.01" placeholder="Takeaway" value={r.takeaway} onChange={(e) => setBranchPricing((prev) => prev.map((x, i) => (i === idx ? { ...x, takeaway: e.target.value } : x)))} />
                  <input type="number" min={0} step="0.01" placeholder="Delivery" value={r.delivery} onChange={(e) => setBranchPricing((prev) => prev.map((x, i) => (i === idx ? { ...x, delivery: e.target.value } : x)))} />
                  <button type="button" className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" onClick={() => setBranchPricing((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                </div>
              ))}
            </div>
            <button type="button" className="mt-2 bg-slate-100 dark:bg-slate-800" onClick={() => setBranchPricing((prev) => [...prev, { branch_id: "", dine_in: "0", takeaway: "0", delivery: "0" }])}>
              + Add branch override
            </button>
          </div>
        </div>
      ) : null}

      {tab === "Variants" ? (
        <div className="space-y-2">
          {variants.map((v, idx) => (
            <div key={idx} className="grid gap-2 sm:grid-cols-3">
              <input placeholder="Variant name" value={v.name} onChange={(e) => setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} />
              <input type="number" min={0} step="0.01" placeholder="Price override" value={v.price_override} onChange={(e) => setVariants((prev) => prev.map((x, i) => (i === idx ? { ...x, price_override: e.target.value } : x)))} />
              <button type="button" className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
            </div>
          ))}
          <button type="button" className="bg-slate-100 dark:bg-slate-800" onClick={() => setVariants((prev) => [...prev, { name: "", price_override: form.price_dine_in }])}>
            + Add variant
          </button>
        </div>
      ) : null}

      {tab === "Modifiers" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {modifierGroups.map((g) => {
            const checked = modifierGroupIds.includes(g.id);
            return (
              <label key={g.id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm dark:border-slate-700">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) =>
                    setModifierGroupIds((prev) =>
                      e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                    )
                  }
                />
                {g.name}
              </label>
            );
          })}
        </div>
      ) : null}

      {tab === "Recipe" ? (
        form.is_recipe_item ? (
          <div className="space-y-2">
            {recipeLines.map((r, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-5">
                <input placeholder="Ingredient item" value={r.item_name} onChange={(e) => setRecipeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, item_name: e.target.value } : x)))} />
                <input type="number" min={0} step="0.001" placeholder="Qty" value={r.qty} onChange={(e) => setRecipeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))} />
                <input placeholder="UOM" value={r.uom} onChange={(e) => setRecipeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, uom: e.target.value } : x)))} />
                <input type="number" min={0} step="0.0001" placeholder="Unit cost" value={r.unit_cost} onChange={(e) => setRecipeLines((prev) => prev.map((x, i) => (i === idx ? { ...x, unit_cost: e.target.value } : x)))} />
                <button type="button" className="bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200" onClick={() => setRecipeLines((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
              </div>
            ))}
            <button type="button" className="bg-slate-100 dark:bg-slate-800" onClick={() => setRecipeLines((prev) => [...prev, { item_name: "", qty: "1", uom: "unit", unit_cost: "0" }])}>
              + Add ingredient
            </button>
          </div>
        ) : (
          <p className="text-sm muted">Enable "Recipe item" in General to build recipe deduction lines.</p>
        )
      ) : null}

      {tab === "Inventory" ? (
        form.track_inventory ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div><label className="text-xs font-medium">Par level</label><input type="number" min={0} step="0.001" value={form.par_level} onChange={(e) => setForm((f) => ({ ...f, par_level: e.target.value }))} /></div>
            <div><label className="text-xs font-medium">Reorder level</label><input type="number" min={0} step="0.001" value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: e.target.value }))} /></div>
            <label className="inline-flex items-center gap-2 text-xs sm:pt-6">
              <input type="checkbox" checked={form.allow_negative} onChange={(e) => setForm((f) => ({ ...f, allow_negative: e.target.checked }))} />
              Allow negative stock
            </label>
          </div>
        ) : (
          <p className="text-sm muted">Enable "Track inventory" in General to configure inventory controls.</p>
        )
      ) : null}

      {tab === "Kitchen" ? (
        <div className="space-y-2">
          <label className="text-xs font-medium">Kitchen routing station</label>
          <select value={form.kitchen_station_id} onChange={(e) => setForm((f) => ({ ...f, kitchen_station_id: e.target.value }))}>
            <option value="hot">Hot kitchen</option>
            <option value="cold">Cold kitchen</option>
            <option value="bar">Bar</option>
            <option value="dessert">Dessert</option>
            <option value="expo">Expo</option>
          </select>
        </div>
      ) : null}

      {tab === "Accounting" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="text-xs font-medium">Tax profile</label><input value={form.tax_profile} onChange={(e) => setForm((f) => ({ ...f, tax_profile: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Sales account</label><input value={form.sales_account} onChange={(e) => setForm((f) => ({ ...f, sales_account: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">COGS account</label><input value={form.cogs_account} onChange={(e) => setForm((f) => ({ ...f, cogs_account: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Inventory account</label><input value={form.inventory_account} onChange={(e) => setForm((f) => ({ ...f, inventory_account: e.target.value }))} /></div>
          <div><label className="text-xs font-medium">Tax account</label><input value={form.tax_account} onChange={(e) => setForm((f) => ({ ...f, tax_account: e.target.value }))} /></div>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-700">
        <button type="button" className="bg-slate-100 dark:bg-slate-800" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="bg-indigo-600 text-white disabled:opacity-60" disabled={!canSubmit || busy}>
          {busy ? "Saving..." : submitLabel || "Create item"}
        </button>
      </div>
    </form>
  );
}

