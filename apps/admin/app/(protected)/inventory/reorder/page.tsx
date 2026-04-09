"use client";

import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";
import { useToast } from "@/components/toast";

export default function ReorderPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const [stock, suppliers] = await Promise.all([apiGet("/inventory/stock-levels"), apiGet("/suppliers")]);
    const sRows = Array.isArray(stock) ? stock : [];
    const supRows = Array.isArray(suppliers) ? suppliers : [];
    const rec = sRows
      .filter((x: any) => Number(x.stockLevel) <= Number(x.reorderPoint))
      .map((x: any) => ({
        ...x,
        suggested_qty: Math.max(Number(x.reorderPoint) * 2 - Number(x.stockLevel), 0),
        supplier_id: supRows[0]?.id || "",
        supplier_name: supRows[0]?.name || "Unlinked"
      }));
    setRows(rec);
  };

  useEffect(() => {
    void load();
  }, []);

  const createPo = async (row: any) => {
    await apiPost("/inventory/purchase-orders", {
      supplier_id: row.supplier_id,
      po_number: `AUTO-${Date.now()}`,
      status: "draft",
      lines: [
        {
          inventory_item_id: row.id,
          quantity: row.suggested_qty,
          unit_price: 0
        }
      ]
    });
    notify("Auto PO draft created from reorder suggestion");
  };

  const totalSuggested = useMemo(() => rows.reduce((s, r) => s + Number(r.suggested_qty || 0), 0), [rows]);

  return (
    <div className="space-y-4">
      <PageHeader title="Reorder Suggestions" description={`Low-stock recommendations. Suggested qty total: ${totalSuggested.toFixed(2)}`} />
      <DataTable
        data={rows}
        columns={[
          { key: "name", header: "Item", render: (r) => r.name },
          { key: "onhand", header: "On hand", render: (r) => Number(r.stockLevel || 0).toFixed(2) },
          { key: "reorder", header: "Reorder level", render: (r) => Number(r.reorderPoint || 0).toFixed(2) },
          { key: "suggested", header: "Suggested", render: (r) => Number(r.suggested_qty || 0).toFixed(2) },
          { key: "supplier", header: "Supplier", render: (r) => r.supplier_name },
          {
            key: "actions",
            header: "Actions",
            render: (r) => (
              <button className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white" onClick={() => void createPo(r)}>
                Create PO
              </button>
            )
          }
        ]}
      />
    </div>
  );
}
