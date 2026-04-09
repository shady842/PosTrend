"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";

export default function AccountsPayablePage() {
  const { notify } = useToast();
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [vendorId, setVendorId] = useState("");
  const [billNo, setBillNo] = useState("");
  const [amount, setAmount] = useState("0");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newStatus, setNewStatus] = useState("draft");

  const load = useCallback(async () => {
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : "";
      const data = (await apiGet(`/accounting/ap-bills${qs}`)) as any[];
      setRows(Array.isArray(data) ? data : []);
      const s = (await apiGet("/suppliers")) as any[];
      setSuppliers(Array.isArray(s) ? s : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load AP");
    }
  }, [status, notify]);

  useEffect(() => void load(), [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  const create = async () => {
    try {
      await apiPost("/accounting/ap-bill", {
        vendor_id: vendorId,
        bill_no: billNo,
        amount: Number(amount),
        status: newStatus,
        due_date: dueDate
      });
      notify("AP bill created");
      setOpen(false);
      setVendorId("");
      setBillNo("");
      setAmount("0");
      setDueDate(new Date().toISOString().slice(0, 10));
      setNewStatus("draft");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to create bill");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Accounts Payable"
        description="AP bills (list). Payment + posting workflow will be added with GL integration."
        action={
          <div className="flex gap-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="posted">Posted</option>
              <option value="paid">Paid</option>
            </select>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setOpen(true)}>
              New
            </button>
          </div>
        }
      />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-900/40">
            <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
              <th className="p-3">Bill #</th>
              <th className="p-3">Status</th>
              <th className="p-3">Due</th>
              <th className="p-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/70">
                <td className="p-3 font-medium">{r.billNo}</td>
                <td className="p-3 text-xs">{r.status}</td>
                <td className="p-3 text-xs">{new Date(r.dueDate).toLocaleDateString()}</td>
                <td className="p-3 text-right font-mono tabular-nums">{Number(r.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-500">
                  No bills.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <div className="sticky bottom-0 border-t border-slate-200/60 bg-white p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900">
          <div className="flex justify-end font-mono tabular-nums">Total {total.toFixed(2)}</div>
        </div>
      </div>
      <DrawerPanel open={open} title="New AP Bill" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Supplier</label>
            <select className="mt-1 w-full" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              <option value="">Select supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Bill #</label>
            <input className="mt-1 w-full" value={billNo} onChange={(e) => setBillNo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Amount</label>
            <input className="mt-1 w-full" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Status</label>
            <select className="mt-1 w-full" value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
              <option value="draft">draft</option>
              <option value="posted">posted</option>
              <option value="paid">paid</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Due date</label>
            <input className="mt-1 w-full" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => void create()}>
              Create
            </button>
          </div>
        </div>
      </DrawerPanel>
    </div>
  );
}

