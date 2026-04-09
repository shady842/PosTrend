"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/components/toast";
import { apiGet, apiPost } from "@/lib/api";

type Build = {
  id: string;
  item: string;
  batchQty: number;
  yieldPct: number;
  status: "planned" | "released" | "completed";
};

export default function ProductionBuildsPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Build[]>([]);
  const [items, setItems] = useState<Array<{ id: string; name: string }>>([]);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [yieldPct, setYieldPct] = useState("100");
  const [wastePct, setWastePct] = useState("0");
  const [lines, setLines] = useState<Array<{ inventory_item_id: string; quantity: string }>>([
    { inventory_item_id: "", quantity: "1" }
  ]);

  useEffect(() => {
    void (async () => {
      const data = await apiGet("/inventory/items");
      const mapped = (Array.isArray(data) ? data : []).map((x: any) => ({ id: x.id, name: x.name }));
      setItems(mapped);
      if (mapped[0]?.id) setItemId(mapped[0].id);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Production Builds" description="Plan and execute sub-recipe/finished-goods production batches." />
      <div className="card grid gap-3 p-4 md:grid-cols-5">
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>
        <input placeholder="Batch qty" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
        <input placeholder="Yield %" type="number" value={yieldPct} onChange={(e) => setYieldPct(e.target.value)} />
        <input placeholder="Waste %" type="number" value={wastePct} onChange={(e) => setWastePct(e.target.value)} />
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
          onClick={async () => {
            if (!itemId) return;
            const ingredientLines = lines
              .map((x) => ({
                inventory_item_id: x.inventory_item_id,
                quantity: Number(x.quantity || 0)
              }))
              .filter((x) => x.inventory_item_id && x.quantity > 0);
            if (!ingredientLines.length) {
              notify("Provide at least one ingredient line");
              return;
            }
            const res = await apiPost("/inventory/production/build", {
              finished_inventory_item_id: itemId,
              build_qty: Number(qty || 0),
              yield_pct: Number(yieldPct || 0),
              waste_pct: Number(wastePct || 0),
              ingredient_lines: ingredientLines
            });
            const itemName = items.find((x) => x.id === itemId)?.name || itemId;
            setRows((prev) => [
              {
                id: res?.production_batch_id || crypto.randomUUID(),
                item: itemName,
                batchQty: Number(res?.produced_qty || qty || 0),
                yieldPct: Number(yieldPct || 0),
                status: "completed"
              },
              ...prev
            ]);
            setLines([{ inventory_item_id: "", quantity: "1" }]);
            notify("Production build completed with stock + posting automation");
          }}
        >
          Execute build
        </button>
        <div className="md:col-span-5 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Ingredient lines</p>
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800"
              onClick={() => setLines((prev) => [...prev, { inventory_item_id: "", quantity: "1" }])}
            >
              + Add line
            </button>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid gap-2 md:grid-cols-[1fr_160px_72px]">
              <select
                value={line.inventory_item_id}
                onChange={(e) =>
                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, inventory_item_id: e.target.value } : x)))
                }
              >
                <option value="">Select ingredient item</option>
                {items
                  .filter((it) => it.id !== itemId)
                  .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
              </select>
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className="rounded-lg bg-rose-100 px-2 py-1 text-xs text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
      <DataTable
        data={rows}
        columns={[
          { key: "item", header: "Item", render: (r) => r.item },
          { key: "qty", header: "Batch qty", render: (r) => String(r.batchQty) },
          { key: "yield", header: "Yield %", render: (r) => String(r.yieldPct) },
          { key: "status", header: "Status", render: (r) => r.status },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <div className="flex gap-2">
                <button
                  className="rounded-lg bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800"
                  onClick={() =>
                    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "released" } : x)))
                  }
                >
                  Release
                </button>
                <button
                  className="rounded-lg bg-emerald-600 px-3 py-1 text-xs text-white"
                  onClick={() => {
                    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: "completed" } : x)));
                    notify("Build state updated");
                  }}
                >
                  Complete
                </button>
              </div>
            )
          }
        ]}
      />
    </div>
  );
}
