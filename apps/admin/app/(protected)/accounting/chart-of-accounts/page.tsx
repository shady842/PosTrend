"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { AccountTreeView, type CoaNode } from "@/components/accounting/account-tree-view";
import { PageHeader } from "@/components/page-header";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";

export default function ChartOfAccountsPage() {
  const { notify } = useToast();
  const [accounts, setAccounts] = useState<CoaNode[]>([]);
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("ASSET");
  const [parentId, setParentId] = useState("");
  const [conceptWide, setConceptWide] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = (await apiGet("/accounting/chart-of-accounts")) as CoaNode[];
      setAccounts(Array.isArray(rows) ? rows : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load chart of accounts");
    }
  }, [notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRow = useMemo(() => accounts.find((a) => a.id === selected) || null, [accounts, selected]);

  const create = async () => {
    try {
      await apiPost("/accounting/chart-of-accounts", {
        code,
        name,
        type,
        parent_id: parentId || undefined,
        concept_wide: conceptWide
      });
      notify("Account created");
      setOpen(false);
      setCode("");
      setName("");
      setType("ASSET");
      setParentId("");
      setConceptWide(false);
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to create account");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Chart of Accounts"
        description="Browse your account hierarchy and quickly search by code/name."
        action={
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setOpen(true)}>
            New account
          </button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[420px_1fr]">
        <AccountTreeView accounts={accounts} selectedId={selected} onSelect={setSelected} />
        <div className="card p-4">
          <h3 className="text-sm font-semibold">Details</h3>
          {!selectedRow ? (
            <p className="muted mt-2 text-sm">Select an account to see details.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="muted">Code</span>
                <span className="font-mono">{selectedRow.code}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="muted">Name</span>
                <span className="font-medium">{selectedRow.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="muted">Type</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">{selectedRow.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="muted">Scope</span>
                <span className="text-xs">{selectedRow.branchId ? "Branch" : "Tenant (shared)"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <DrawerPanel open={open} title="New Chart Account" onClose={() => setOpen(false)}>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Code</label>
            <input className="mt-1 w-full" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Name</label>
            <input className="mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium">Type</label>
            <select className="mt-1 w-full" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="ASSET">ASSET</option>
              <option value="LIABILITY">LIABILITY</option>
              <option value="EQUITY">EQUITY</option>
              <option value="INCOME">INCOME</option>
              <option value="EXPENSE">EXPENSE</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium">Parent (optional)</label>
            <select className="mt-1 w-full" value={parentId} onChange={(e) => setParentId(e.target.value)}>
              <option value="">None</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={conceptWide} onChange={(e) => setConceptWide(e.target.checked)} />
            Concept-wide (all branches)
          </label>
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

