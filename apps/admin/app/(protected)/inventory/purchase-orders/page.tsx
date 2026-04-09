"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { AdvancedInventoryTable, InvColumn } from "@/components/inventory/advanced-table";
import { DrawerPanel } from "@/components/drawer-panel";
import { StatusBadge } from "@/components/inventory/status-badge";
import { useToast } from "@/components/toast";

type Supplier = { id: string; name: string; status: string };
type InvItem = { id: string; name: string; sku: string };
type PoLine = { inventory_item_id: string; quantity: number; unit_price: number };
type PO = {
  id: string;
  poNumber: string;
  status: string;
  createdAt: string;
  supplier: { name: string };
  lines: Array<{ quantity: unknown; unitPrice: unknown; inventoryItem: { name: string } }>;
};

function num(v: unknown) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

export default function PurchaseOrdersPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<PO[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InvItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [status, setStatus] = useState<"draft" | "approved" | "received">("draft");
  const [lines, setLines] = useState<PoLine[]>([{ inventory_item_id: "", quantity: 1, unit_price: 0 }]);

  const load = useCallback(async () => {
    try {
      const data = (await apiGet("/inventory/purchase-orders")) as PO[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load POs");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const openWizard = async () => {
    setStep(1);
    setSupplierId("");
    setPoNumber(`PO-${Date.now().toString(36).toUpperCase()}`);
    setStatus("draft");
    setLines([{ inventory_item_id: "", quantity: 1, unit_price: 0 }]);
    setOpen(true);
    try {
      const [s, i] = await Promise.all([apiGet("/suppliers") as Promise<Supplier[]>, apiGet("/inventory/items") as Promise<InvItem[]>]);
      setSuppliers(Array.isArray(s) ? s : []);
      setItems(Array.isArray(i) ? i : []);
      if (Array.isArray(s) && s[0]) setSupplierId(s[0].id);
      if (Array.isArray(i) && i[0]) {
        setLines([{ inventory_item_id: i[0].id, quantity: 1, unit_price: 0 }]);
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load form data");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const clean = lines.filter((l) => l.inventory_item_id && l.quantity > 0);
    if (!supplierId || !poNumber.trim() || !clean.length) {
      notify("Supplier, PO #, and at least one line required");
      return;
    }
    try {
      await apiPost("/inventory/purchase-order", {
        supplier_id: supplierId,
        po_number: poNumber.trim(),
        status,
        lines: clean.map((l) => ({
          inventory_item_id: l.inventory_item_id,
          quantity: l.quantity,
          unit_price: l.unit_price
        }))
      });
      notify("Purchase order created");
      setOpen(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Failed");
    }
  };

  const columns: InvColumn<PO>[] = [
    {
      key: "po",
      header: "PO #",
      searchValue: (r) => r.poNumber,
      render: (r) => <span className="font-mono text-xs">{r.poNumber}</span>
    },
    {
      key: "supplier",
      header: "Supplier",
      searchValue: (r) => r.supplier?.name ?? "",
      render: (r) => r.supplier?.name ?? "—"
    },
    {
      key: "status",
      header: "Status",
      searchValue: (r) => r.status,
      render: (r) => <StatusBadge status={r.status} />
    },
    {
      key: "lines",
      header: "Lines",
      defaultHidden: true,
      searchValue: (r) => String(r.lines?.length ?? 0),
      render: (r) => String(r.lines?.length ?? 0)
    },
    {
      key: "total",
      header: "Total",
      searchValue: (r) =>
        String(
          r.lines?.reduce((s, l) => s + num(l.quantity) * num(l.unitPrice), 0) ?? 0
        ),
      render: (r) => {
        const t = r.lines?.reduce((s, l) => s + num(l.quantity) * num(l.unitPrice), 0) ?? 0;
        return `$${t.toFixed(2)}`;
      }
    },
    {
      key: "created",
      header: "Created",
      defaultHidden: true,
      searchValue: (r) => r.createdAt,
      render: (r) => new Date(r.createdAt).toLocaleString()
    }
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase orders"
        description="Create and track POs for this branch."
        action={
          <button type="button" className="bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => void openWizard()}>
            New purchase order
          </button>
        }
      />
      <AdvancedInventoryTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        viewStorageKey="inv_po"
        searchPlaceholder="Search PO or supplier…"
      />

      <DrawerPanel open={open} title="New purchase order" onClose={() => setOpen(false)} panelClassName="max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <div className="flex gap-2 text-xs font-medium text-slate-500">
            {[1, 2, 3].map((s) => (
              <span key={s} className={step === s ? "text-indigo-600" : ""}>
                Step {s}
                {s === 1 ? " · Details" : s === 2 ? " · Lines" : " · Review"}
              </span>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-3">
              <label className="block text-xs font-medium">Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <label className="block text-xs font-medium">PO number</label>
              <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required />
              <label className="block text-xs font-medium">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="received">Received (adds stock)</option>
              </select>
              <button type="button" className="w-full bg-slate-800 text-white dark:bg-indigo-600" onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              {lines.map((line, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <label className="mb-1 block text-xs">Item</label>
                  <select
                    value={line.inventory_item_id}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, inventory_item_id: v } : l)));
                    }}
                  >
                    <option value="">Select…</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.name} ({it.sku})
                      </option>
                    ))}
                  </select>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs">Qty</label>
                      <input
                        type="number"
                        min={0.001}
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) => {
                          const q = parseFloat(e.target.value) || 0;
                          setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, quantity: q } : l)));
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs">Unit price</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unit_price}
                        onChange={(e) => {
                          const p = parseFloat(e.target.value) || 0;
                          setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unit_price: p } : l)));
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="text-sm text-indigo-600 underline"
                onClick={() => setLines((prev) => [...prev, { inventory_item_id: items[0]?.id || "", quantity: 1, unit_price: 0 }])}
              >
                + Add line
              </button>
              <div className="flex gap-2">
                <button type="button" className="flex-1 bg-slate-100 dark:bg-slate-800" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="flex-1 bg-indigo-600 text-white" onClick={() => setStep(3)}>
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <p>
                <span className="muted">Supplier:</span> {suppliers.find((s) => s.id === supplierId)?.name}
              </p>
              <p>
                <span className="muted">PO #:</span> {poNumber}
              </p>
              <p>
                <span className="muted">Status:</span> <StatusBadge status={status} />
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700">
                {lines
                  .filter((l) => l.inventory_item_id)
                  .map((l, i) => {
                    const it = items.find((x) => x.id === l.inventory_item_id);
                    return (
                      <li key={i}>
                        {it?.name} × {l.quantity} @ ${l.unit_price.toFixed(2)}
                      </li>
                    );
                  })}
              </ul>
              <div className="flex gap-2">
                <button type="button" className="flex-1 bg-slate-100 dark:bg-slate-800" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="submit" className="flex-1 bg-indigo-600 text-white">
                  Submit
                </button>
              </div>
            </div>
          )}
        </form>
      </DrawerPanel>
    </div>
  );
}
