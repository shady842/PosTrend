"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import {
  ChevronRight,
  GripVertical,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DrawerPanel } from "@/components/drawer-panel";
import { FormModal } from "@/components/form-modal";
import { AdvancedItemCreateForm, type AdvancedMenuCreatePayload } from "@/components/menu/advanced-item-create-form";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

const ALL_CATEGORIES = "";

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

type MenuCategoryRow = {
  id: string;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

type ItemVariantRow = {
  id: string;
  name: string;
  price: unknown;
  sku?: string | null;
  barcode?: string | null;
  isDefault: boolean;
};

type ModifierGroupRow = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  isRequired: boolean;
  options: { id: string; name: string; price: unknown; displayOrder: number }[];
};

type ModifierLinkRow = {
  id: string;
  menuItemId: string;
  modifierGroupId: string;
  modifierGroup: ModifierGroupRow;
};

type MenuItemRow = {
  id: string;
  categoryId: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  basePrice: unknown;
  isActive: boolean;
  displayOrder: number;
  variants: ItemVariantRow[];
  modifierLinks?: ModifierLinkRow[];
};

export default function MenuBuilderPage() {
  const { notify } = useToast();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<MenuCategoryRow[]>([]);
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(ALL_CATEGORIES);
  const [selectedItem, setSelectedItem] = useState<MenuItemRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [modifierModalOpen, setModifierModalOpen] = useState(false);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupRow[]>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [editInitial, setEditInitial] = useState<Partial<AdvancedMenuCreatePayload> | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [variantForm, setVariantForm] = useState({ name: "", price: "0" });
  const [modGroupForm, setModGroupForm] = useState({
    name: "",
    min_select: "0",
    max_select: "1",
    is_required: false
  });
  const [modOptionForm, setModOptionForm] = useState({
    modifier_group_id: "",
    name: "",
    price: "0"
  });

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, pack, groups, branchRows] = await Promise.all([
        apiGet("/menu/categories") as Promise<MenuCategoryRow[]>,
        apiGet("/menu/items?limit=500") as Promise<{ items: MenuItemRow[] }>,
        apiGet("/menu/modifier-groups") as Promise<ModifierGroupRow[]>,
        apiGet("/branches") as Promise<Array<{ id: string; name: string }>>
      ]);
      setCategories(cats || []);
      setCategoryOrder((cats || []).sort((a, b) => a.displayOrder - b.displayOrder).map((c) => c.id));
      setItems(pack?.items || []);
      setModifierGroups(groups || []);
      setBranches(Array.isArray(branchRows) ? branchRows : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const orderedCategories = useMemo(() => {
    const map = new Map(categories.map((c) => [c.id, c]));
    return categoryOrder.map((id) => map.get(id)).filter(Boolean) as MenuCategoryRow[];
  }, [categories, categoryOrder]);

  const filteredItems = useMemo(() => {
    let list = !selectedCategoryId
      ? [...items]
      : items.filter((i) => i.categoryId === selectedCategoryId);
    list.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [items, selectedCategoryId]);

  const itemIdsForReorder = useMemo(() => filteredItems.map((i) => i.id), [filteredItems]);

  const openEditor = async (item: MenuItemRow) => {
    setSelectedItem(item);
    setDrawerOpen(true);
    setEditLoading(true);
    try {
      const cfg = (await apiGet(`/menu/items/${item.id}/advanced-config`)) as any;
      setEditInitial({
        category_id: item.categoryId || categories[0]?.id || "",
        name: item.name,
        description: item.description || "",
        sku: item.sku || "",
        barcode: "",
        image_url: item.imageUrl || "",
        is_active: item.isActive,
        base_price: num(item.basePrice),
        tax_profile: cfg?.accounting?.tax_profile || "default",
        kitchen_station_id: "hot",
        price_takeaway: num(cfg?.price_takeaway),
        price_delivery: num(cfg?.price_delivery),
        track_inventory: Boolean(cfg?.track_inventory),
        is_recipe_item: Boolean(cfg?.is_recipe_item),
        branch_price_overrides: Array.isArray(cfg?.branch_price_overrides) ? cfg.branch_price_overrides : [],
        recipe_ingredients: Array.isArray(cfg?.recipe_ingredients) ? cfg.recipe_ingredients : [],
        inventory: cfg?.inventory || { par_level: 0, reorder_level: 0, allow_negative: false },
        accounting: cfg?.accounting || {
          sales_account: "4000-SALES",
          cogs_account: "5000-COGS",
          inventory_account: "1200-INVENTORY",
          tax_account: "2100-VAT-PAYABLE"
        },
        variants: (item.variants || []).map((v) => ({ name: v.name, price_override: num(v.price) })),
        modifier_group_ids: (item.modifierLinks || []).map((l) => l.modifierGroupId)
      });
    } catch {
      setEditInitial({
        category_id: item.categoryId || categories[0]?.id || "",
        name: item.name,
        description: item.description || "",
        sku: item.sku || "",
        barcode: "",
        image_url: item.imageUrl || "",
        is_active: item.isActive,
        base_price: num(item.basePrice),
        price_takeaway: 0,
        price_delivery: 0,
        tax_profile: "default",
        kitchen_station_id: "hot",
        track_inventory: false,
        is_recipe_item: false,
        branch_price_overrides: [],
        recipe_ingredients: [],
        inventory: { par_level: 0, reorder_level: 0, allow_negative: false },
        accounting: {
          sales_account: "4000-SALES",
          cogs_account: "5000-COGS",
          inventory_account: "1200-INVENTORY",
          tax_account: "2100-VAT-PAYABLE"
        },
        variants: (item.variants || []).map((v) => ({ name: v.name, price_override: num(v.price) })),
        modifier_group_ids: (item.modifierLinks || []).map((l) => l.modifierGroupId)
      });
    } finally {
      setEditLoading(false);
    }
  };

  const refreshItemInState = (updated: MenuItemRow) => {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? { ...i, ...updated } : i)));
    setSelectedItem((cur) => (cur?.id === updated.id ? { ...cur, ...updated } : cur));
  };

  const onCategoriesReorder = async (next: string[]) => {
    setCategoryOrder(next);
    try {
      await apiPost("/menu/categories/reorder", { ordered_ids: next });
      notify("Category order saved");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Reorder failed");
      void loadAll();
    }
  };

  const onItemsReorder = async (nextIds: string[]) => {
    if (!selectedCategoryId) return;
    setItems((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      const inCat = nextIds.map((id) => map.get(id)).filter(Boolean) as MenuItemRow[];
      const rest = prev.filter((i) => i.categoryId !== selectedCategoryId);
      return [...rest, ...inCat];
    });
    try {
      await apiPost("/menu/items/reorder", {
        category_id: selectedCategoryId,
        ordered_ids: nextIds
      });
      notify("Item order saved");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Reorder failed");
      void loadAll();
    }
  };

  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiPost("/menu/categories", { name: newCategoryName.trim() });
      setNewCategoryName("");
      await loadAll();
      notify("Category created");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const createItem = async (payload: AdvancedMenuCreatePayload) => {
    if (!categories.length) {
      notify("Create a category first");
      return;
    }
    const cid = payload.category_id;
    if (!cid || !payload.name.trim()) {
      notify("Name and category are required");
      return;
    }
    try {
      const created = (await apiPost("/menu/items", {
        category_id: cid,
        name: payload.name.trim(),
        description: payload.description || undefined,
        sku: payload.sku || undefined,
        barcode: payload.barcode || undefined,
        base_price: payload.base_price || 0,
        image_url: payload.image_url || undefined,
        kitchen_station_id: payload.kitchen_station_id || undefined,
        tax_profile: payload.tax_profile || undefined,
        is_active: payload.is_active
      })) as MenuItemRow;

      for (const v of payload.variants) {
        await apiPost("/menu/variants", {
          menu_item_id: created.id,
          name: v.name,
          price: v.price_override
        });
      }
      for (const groupId of payload.modifier_group_ids) {
        await apiPost("/menu/item-modifiers", {
          menu_item_id: created.id,
          modifier_group_id: groupId
        });
      }

      await apiPut(`/menu/items/${created.id}/advanced-config`, {
        price_takeaway: payload.price_takeaway,
        price_delivery: payload.price_delivery,
        track_inventory: payload.track_inventory,
        is_recipe_item: payload.is_recipe_item,
        branch_price_overrides: payload.branch_price_overrides,
        recipe_ingredients: payload.recipe_ingredients,
        inventory: payload.inventory,
        accounting: payload.accounting
      });

      setCreateOpen(false);
      await loadAll();
      notify("Item created with advanced setup");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const updateItemAdvanced = async (payload: AdvancedMenuCreatePayload) => {
    if (!selectedItem) return;
    try {
      await apiPatch(`/menu/items/${selectedItem.id}`, {
        category_id: payload.category_id,
        name: payload.name,
        description: payload.description || undefined,
        sku: payload.sku || undefined,
        image_url: payload.image_url || undefined,
        base_price: payload.base_price || 0,
        kitchen_station_id: payload.kitchen_station_id || undefined,
        tax_profile: payload.tax_profile || undefined,
        is_active: payload.is_active
      });

      const existingLinks = selectedItem.modifierLinks || [];
      const existingGroupIds = new Set(existingLinks.map((l) => l.modifierGroupId));
      for (const link of existingLinks) {
        if (!payload.modifier_group_ids.includes(link.modifierGroupId)) {
          await apiDelete(`/menu/item-modifiers/${link.id}`);
        }
      }
      for (const groupId of payload.modifier_group_ids) {
        if (!existingGroupIds.has(groupId)) {
          await apiPost("/menu/item-modifiers", { menu_item_id: selectedItem.id, modifier_group_id: groupId });
        }
      }

      const existingVariants = selectedItem.variants || [];
      for (const v of payload.variants) {
        const exists = existingVariants.some(
          (x) => x.name.trim().toLowerCase() === v.name.trim().toLowerCase() && num(x.price) === v.price_override
        );
        if (!exists) {
          await apiPost("/menu/variants", { menu_item_id: selectedItem.id, name: v.name, price: v.price_override });
        }
      }

      await apiPut(`/menu/items/${selectedItem.id}/advanced-config`, {
        price_takeaway: payload.price_takeaway,
        price_delivery: payload.price_delivery,
        track_inventory: payload.track_inventory,
        is_recipe_item: payload.is_recipe_item,
        branch_price_overrides: payload.branch_price_overrides,
        recipe_ingredients: payload.recipe_ingredients,
        inventory: payload.inventory,
        accounting: payload.accounting
      });

      await loadAll();
      setDrawerOpen(false);
      setSelectedItem(null);
      notify("Item updated");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed to update item");
    }
  };

  const patchItemField = async (itemId: string, body: Record<string, unknown>) => {
    try {
      const updated = (await apiPatch(`/menu/items/${itemId}`, body)) as MenuItemRow;
      refreshItemInState(updated);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Update failed");
    }
  };

  const onImageFile = (itemId: string | null, file: File | null) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 380_000) {
      notify("Image too large — use a smaller file or paste a URL");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (itemId) void patchItemField(itemId, { image_url: url });
    };
    reader.readAsDataURL(file);
  };

  const addVariant = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !variantForm.name.trim()) return;
    try {
      await apiPost("/menu/variants", {
        menu_item_id: selectedItem.id,
        name: variantForm.name.trim(),
        price: parseFloat(variantForm.price) || 0
      });
      setVariantForm({ name: "", price: "0" });
      await loadAll();
      notify("Variant added");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const createModifierGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!modGroupForm.name.trim()) return;
    try {
      await apiPost("/menu/modifier-groups", {
        name: modGroupForm.name.trim(),
        min_select: parseInt(modGroupForm.min_select, 10) || 0,
        max_select: parseInt(modGroupForm.max_select, 10) || 1,
        is_required: modGroupForm.is_required
      });
      setModGroupForm({ name: "", min_select: "0", max_select: "1", is_required: false });
      const groups = (await apiGet("/menu/modifier-groups")) as ModifierGroupRow[];
      setModifierGroups(groups || []);
      notify("Modifier group created");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const createModifierOption = async (e: FormEvent) => {
    e.preventDefault();
    if (!modOptionForm.modifier_group_id || !modOptionForm.name.trim()) return;
    try {
      await apiPost("/menu/modifier-options", {
        modifier_group_id: modOptionForm.modifier_group_id,
        name: modOptionForm.name.trim(),
        price: parseFloat(modOptionForm.price) || 0
      });
      setModOptionForm((f) => ({ ...f, name: "", price: "0" }));
      const groups = (await apiGet("/menu/modifier-groups")) as ModifierGroupRow[];
      setModifierGroups(groups || []);
      notify("Option added");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const attachModifier = async (groupId: string) => {
    if (!selectedItem) return;
    try {
      await apiPost("/menu/item-modifiers", {
        menu_item_id: selectedItem.id,
        modifier_group_id: groupId
      });
      await loadAll();
      notify("Modifier attached");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Already attached or failed");
    }
  };

  const detachModifier = async (linkId: string) => {
    try {
      await apiDelete(`/menu/item-modifiers/${linkId}`);
      await loadAll();
      notify("Modifier removed");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  useEffect(() => {
    if (!selectedItem) return;
    const fresh = items.find((i) => i.id === selectedItem.id);
    if (fresh) setSelectedItem(fresh);
  }, [items, selectedItem?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center muted">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.2, repeat: Infinity }}
          className="text-sm"
        >
          Loading menu…
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative space-y-4 pb-24">
      <PageHeader
        title="Menu builder"
        description="Categories, items, variants, and modifiers — drag to reorder, edit inline."
        action={
          <button
            type="button"
            className="hidden bg-indigo-600 text-white hover:bg-indigo-500 sm:inline-flex"
            onClick={() => {
              if (!categories.length) notify("Create a category first");
              else setCreateOpen(true);
            }}
          >
            <Plus className="mr-1 h-4 w-4" />
            New item
          </button>
        }
      />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside
          className={cn(
            "glass card sticky top-20 z-10 w-full shrink-0 lg:w-72",
            "max-h-[min(68vh,560px)] overflow-y-auto p-3"
          )}
        >
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <Sparkles className="h-3.5 w-3.5" />
            Categories
          </div>
          <button
            type="button"
            onClick={() => setSelectedCategoryId(ALL_CATEGORIES)}
            className={cn(
              "mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
              selectedCategoryId === ALL_CATEGORIES
                ? "bg-indigo-600 text-white shadow"
                : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            All items
            <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
          </button>

          <Reorder.Group
            axis="y"
            values={categoryOrder}
            onReorder={onCategoriesReorder}
            className="space-y-1"
          >
            {categoryOrder.map((id) => {
              const c = categories.find((x) => x.id === id);
              if (!c) return null;
              const count = items.filter((i) => i.categoryId === c.id).length;
              return (
                <Reorder.Item
                  key={c.id}
                  value={c.id}
                  className="list-none"
                  whileDrag={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,.12)" }}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-xl border border-transparent transition",
                      selectedCategoryId === c.id
                        ? "border-indigo-200 bg-indigo-50 dark:border-indigo-500/40 dark:bg-indigo-500/10"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    )}
                  >
                    <span className="cursor-grab touch-none px-1 text-slate-400 hover:text-slate-600">
                      <GripVertical className="h-4 w-4" />
                    </span>
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 py-2 pr-2 text-left text-sm"
                      onClick={() => setSelectedCategoryId(c.id)}
                    >
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="ml-auto shrink-0 rounded-full bg-slate-200/80 px-2 py-0.5 text-xs dark:bg-slate-700">
                        {count}
                      </span>
                    </button>
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          <form onSubmit={addCategory} className="mt-4 flex gap-2 border-t border-slate-200/80 pt-3 dark:border-slate-700/80">
            <input
              className="min-w-0 flex-1 text-xs"
              placeholder="New category"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <button type="submit" className="shrink-0 bg-slate-800 text-white dark:bg-indigo-600">
              Add
            </button>
          </form>
        </aside>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm muted">
              {selectedCategoryId
                ? `Showing “${categories.find((c) => c.id === selectedCategoryId)?.name}” — drag cards to reorder`
                : "All categories — select one to reorder items"}
            </p>
            <button
              type="button"
              className="sm:hidden bg-indigo-600 text-white"
              onClick={() => setCreateOpen(true)}
            >
              New item
            </button>
          </div>

          {selectedCategoryId ? (
            <Reorder.Group
              axis="y"
              values={itemIdsForReorder}
              onReorder={onItemsReorder}
              className="mx-auto flex max-w-4xl flex-col gap-3"
            >
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <Reorder.Item
                    key={item.id}
                    value={item.id}
                    className="list-none"
                    whileDrag={{ scale: 1.01, zIndex: 20 }}
                  >
                    <motion.article
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="card group flex overflow-hidden soft-hover sm:flex-row"
                    >
                      <div className="relative h-36 w-full shrink-0 bg-slate-100 sm:h-auto sm:w-44">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-slate-400">
                            <ImagePlus className="h-10 w-10 opacity-40" />
                          </div>
                        )}
                        <span className="absolute left-2 top-2 cursor-grab rounded-lg bg-white/90 p-1 shadow dark:bg-slate-900/90">
                          <GripVertical className="h-4 w-4" />
                        </span>
                        <button
                          type="button"
                          className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 shadow transition hover:bg-white dark:bg-slate-900/90"
                          onClick={() => void openEditor(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-4">
                        <div className="font-medium leading-snug">{item.name}</div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-xs uppercase text-slate-500">Price</span>
                          <input
                            className="w-28 py-1 text-xs"
                            defaultValue={num(item.basePrice).toFixed(2)}
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!Number.isFinite(v) || v < 0) return;
                              if (v !== num(item.basePrice)) void patchItemField(item.id, { base_price: v });
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-left text-xs text-slate-600 dark:text-slate-300"
                          onClick={() =>
                            void patchItemField(item.id, { is_active: !item.isActive })
                          }
                        >
                          {item.isActive ? (
                            <ToggleRight className="h-6 w-6 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="h-6 w-6 text-slate-400" />
                          )}
                          {item.isActive ? "Enabled on POS" : "Disabled"}
                        </button>
                      </div>
                    </motion.article>
                  </Reorder.Item>
                ))}
              </AnimatePresence>
            </Reorder.Group>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredItems.map((item) => (
                <motion.article
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="card flex flex-col overflow-hidden soft-hover"
                >
                  <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">
                        <ImagePlus className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <button
                      type="button"
                      className="absolute right-2 top-2 rounded-lg bg-white/90 p-1.5 shadow dark:bg-slate-900/90"
                      onClick={() => void openEditor(item)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-3">
                    <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                      {categories.find((c) => c.id === item.categoryId)?.name ?? "Uncategorized"}
                    </div>
                    <div className="font-medium leading-snug">{item.name}</div>
                    <div className="flex items-center gap-2">
                      <input
                        className="w-24 py-1 text-xs"
                        defaultValue={num(item.basePrice).toFixed(2)}
                        onBlur={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!Number.isFinite(v) || v < 0) return;
                          if (v !== num(item.basePrice)) void patchItemField(item.id, { base_price: v });
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left text-xs"
                      onClick={() => void patchItemField(item.id, { is_active: !item.isActive })}
                    >
                      {item.isActive ? (
                        <ToggleRight className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-slate-400" />
                      )}
                      {item.isActive ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                </motion.article>
              ))}
            </div>
          )}

          {!filteredItems.length && (
            <div className="card border-dashed p-10 text-center text-sm muted">
              No items here yet. Add an item or pick another category.
            </div>
          )}
        </div>
      </div>

      <motion.button
        type="button"
        className="fixed bottom-8 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
        onClick={() => {
          if (!categories.length) notify("Create a category first");
          else setCreateOpen(true);
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.96 }}
        aria-label="Add menu item"
      >
        <Plus className="h-7 w-7" />
      </motion.button>

      <DrawerPanel open={createOpen} title="New advanced menu item" onClose={() => setCreateOpen(false)} panelClassName="max-w-4xl">
        <AdvancedItemCreateForm
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          branches={branches}
          modifierGroups={modifierGroups.map((m) => ({ id: m.id, name: m.name }))}
          onCancel={() => setCreateOpen(false)}
          onSubmit={createItem}
        />
      </DrawerPanel>

      <DrawerPanel
        open={drawerOpen && !!selectedItem}
        title={selectedItem ? selectedItem.name : "Item"}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedItem(null);
        }}
        panelClassName="max-w-4xl"
      >
        {selectedItem && editInitial && !editLoading ? (
          <>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                className="bg-slate-100 text-xs dark:bg-slate-800"
                onClick={() => setModifierModalOpen(true)}
              >
                Manage modifier groups
              </button>
            </div>
            <AdvancedItemCreateForm
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              branches={branches}
              modifierGroups={modifierGroups.map((m) => ({ id: m.id, name: m.name }))}
              initialValues={editInitial}
              submitLabel="Save changes"
              onCancel={() => {
                setDrawerOpen(false);
                setSelectedItem(null);
              }}
              onSubmit={updateItemAdvanced}
            />
          </>
        ) : (
          <div className="p-4 text-sm muted">Loading advanced item settings...</div>
        )}
      </DrawerPanel>

      <FormModal
        open={modifierModalOpen}
        title="Modifiers"
        onClose={() => setModifierModalOpen(false)}
        panelClassName="max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="space-y-6 text-sm">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Attach to this item</h3>
            <div className="flex flex-wrap gap-2">
              {modifierGroups.map((g) => {
                const linked = selectedItem?.modifierLinks?.some((l) => l.modifierGroupId === g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={linked}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs transition",
                      linked
                        ? "cursor-default bg-slate-200 text-slate-500 dark:bg-slate-700"
                        : "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200"
                    )}
                    onClick={() => void attachModifier(g.id)}
                  >
                    + {g.name}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">New modifier group</h3>
            <form className="grid gap-2 sm:grid-cols-2" onSubmit={createModifierGroup}>
              <input
                placeholder="Name"
                value={modGroupForm.name}
                onChange={(e) => setModGroupForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Min"
                value={modGroupForm.min_select}
                onChange={(e) => setModGroupForm((f) => ({ ...f, min_select: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Max"
                value={modGroupForm.max_select}
                onChange={(e) => setModGroupForm((f) => ({ ...f, max_select: e.target.value }))}
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={modGroupForm.is_required}
                  onChange={(e) => setModGroupForm((f) => ({ ...f, is_required: e.target.checked }))}
                />
                Required
              </label>
              <button type="submit" className="bg-slate-800 text-white sm:col-span-2 dark:bg-indigo-600">
                Create group
              </button>
            </form>
          </section>
          <section className="border-t border-slate-200 pt-4 dark:border-slate-700">
            <h3 className="mb-2 text-xs font-semibold uppercase text-slate-500">Add option to group</h3>
            <form className="grid gap-2 sm:grid-cols-2" onSubmit={createModifierOption}>
              <select
                value={modOptionForm.modifier_group_id}
                onChange={(e) => setModOptionForm((f) => ({ ...f, modifier_group_id: e.target.value }))}
              >
                <option value="">Select group</option>
                {modifierGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Option name"
                value={modOptionForm.name}
                onChange={(e) => setModOptionForm((f) => ({ ...f, name: e.target.value }))}
              />
              <input
                type="number"
                placeholder="Price"
                min={0}
                step="0.01"
                value={modOptionForm.price}
                onChange={(e) => setModOptionForm((f) => ({ ...f, price: e.target.value }))}
              />
              <button type="submit" className="bg-slate-800 text-white sm:col-span-2 dark:bg-indigo-600">
                Add option
              </button>
            </form>
          </section>
        </div>
      </FormModal>
    </div>
  );
}
