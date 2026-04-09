"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AdvancedInventoryTable, InvColumn } from "@/components/inventory/advanced-table";
import { useToast } from "@/components/toast";
type LevelRow = { id: string; name: string; stockLevel: unknown; reorderPoint: unknown };
type LotRow = {
  id: string;
  item_name: string;
  lot_number: string;
  expiry_date: string;
  quantity: number;
  expiring_soon: boolean;
};

function num(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

export default function StockLevelsPage() {
  const { notify } = useToast();
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [lots, setLots] = useState<LotRow[]>([]);
  const load = useCallback(async () => {
    try {
      const [l, t] = await Promise.all([apiGet("/inventory/stock-levels") as Promise<LevelRow[]>, apiGet("/inventory/lot-tracking") as Promise<LotRow[]>]);
      setLevels(Array.isArray(l) ? l : []);
      setLots(Array.isArray(t) ? t : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load stock");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyQty = async (row: LevelRow, input: string) => {
    const target = parseFloat(input);
    if (!Number.isFinite(target) || target < 0) {
      notify("Invalid quantity");
      return;
    }
    const current = num(row.stockLevel);
    const delta = target - current;
    if (delta === 0) return;
    try {
      await apiPost("/inventory/adjust", {
        inventory_item_id: row.id,
        qty: delta,
        reason: "inline_qty",
        adjusted_by: "admin_ui"
      });
      notify("Stock updated");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Adjust failed");
    }
  };

  const levelColumns: InvColumn<LevelRow>[] = [
    {
      key: "name",
      header: "Item",
      searchValue: (r) => r.name,
      render: (r) => <span className="font-medium">{r.name}</span>
    },
    {
      key: "qty",
      header: "Qty (inline)",
      searchValue: (r) => String(num(r.stockLevel)),
      render: (r) => (
        <input
          className="w-24 py-1 text-xs font-mono"
          defaultValue={num(r.stockLevel).toFixed(2)}
          onBlur={(e) => void applyQty(r, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      )
    },
    {
      key: "reorder",
      header: "Reorder",
      searchValue: (r) => String(num(r.reorderPoint)),
      render: (r) => num(r.reorderPoint).toFixed(2)
    }
  ];

  const lotColumns: InvColumn<LotRow>[] = [
    {
      key: "item",
      header: "Item",
      searchValue: (r) => r.item_name,
      render: (r) => r.item_name
    },
    {
      key: "lot",
      header: "Lot",
      searchValue: (r) => r.lot_number,
      render: (r) => <code className="text-xs">{r.lot_number}</code>
    },
    {
      key: "exp",
      header: "Expiry",
      searchValue: (r) => r.expiry_date,
      render: (r) => new Date(r.expiry_date).toLocaleDateString()
    },
    {
      key: "qty",
      header: "Qty",
      searchValue: (r) => String(r.quantity),
      render: (r) => r.quantity.toFixed(2)
    }
  ];

  return (
    <div className="space-y-10">
      <PageHeader title="Stock levels" description="Edit on-hand quantities; low-stock rows are highlighted." />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Levels</h2>
        <AdvancedInventoryTable
          data={levels}
          columns={levelColumns}
          getRowId={(r) => r.id}
          viewStorageKey="inv_stock_levels"
          searchPlaceholder="Search items…"
          rowClassName={(r) =>
            num(r.stockLevel) <= num(r.reorderPoint) && num(r.reorderPoint) > 0
              ? "bg-amber-50/90 dark:bg-amber-950/30"
              : undefined
          }
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Lots &amp; expiry</h2>
        <p className="muted mb-3 text-xs">Rows in rose highlight expire within 30 days.</p>
        <AdvancedInventoryTable
          data={lots}
          columns={lotColumns}
          getRowId={(r) => r.id}
          viewStorageKey="inv_lots"
          searchPlaceholder="Search lots…"
          emptyMessage="No lot tracking rows for this branch."
          rowClassName={(r) => (r.expiring_soon ? "bg-rose-50/90 ring-1 ring-rose-200 dark:bg-rose-950/35 dark:ring-rose-900" : undefined)}
        />
      </section>
    </div>
  );
}
