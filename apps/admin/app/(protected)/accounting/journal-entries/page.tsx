"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Search, UploadCloud } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

export default function JournalEntriesPage() {
  const { notify } = useToast();

  type Coa = { id: string; code: string; name: string; type: string };
  type Line = {
    account_id?: string;
    account_code?: string;
    debit: number;
    credit: number;
    reference_type?: string;
    reference_id?: string;
  };
  type Entry = {
    id: string;
    date: string;
    description: string | null;
    branchId: string | null;
    createdBy: string | null;
    refType: string | null;
    refId: string | null;
    totalDebit: any;
    totalCredit: any;
    postedAt: string | null;
    createdAt: string;
    lines: any[];
  };

  const [coa, setCoa] = useState<Coa[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);

  // Filters
  const [q, setQ] = useState("");
  const [posted, setPosted] = useState<"" | "posted" | "draft">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Editor
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eDate, setEDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eDesc, setEDesc] = useState("");
  const [eCreatedBy, setECreatedBy] = useState("admin");
  const [eLines, setELines] = useState<Line[]>([{ debit: 0, credit: 0 }]);

  const num = (v: any) => (typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) || 0 : 0);

  const loadCoa = useCallback(async () => {
    try {
      const data = (await apiGet("/accounting/chart-of-accounts")) as Coa[];
      setCoa(Array.isArray(data) ? data : []);
    } catch {
      setCoa([]);
    }
  }, []);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (posted === "posted") params.set("posted", "true");
    if (posted === "draft") params.set("posted", "false");
    try {
      const data = (await apiGet(`/accounting/journal-entries?${params.toString()}`)) as Entry[];
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load journal entries");
    }
  }, [q, dateFrom, dateTo, posted, notify]);

  useEffect(() => {
    void loadCoa();
    void load();
  }, [loadCoa, load]);

  const totals = useMemo(() => {
    const visible = rows;
    const debit = visible.reduce((s, r) => s + num(r.totalDebit), 0);
    const credit = visible.reduce((s, r) => s + num(r.totalCredit), 0);
    return { debit, credit, count: visible.length };
  }, [rows]);

  const editorTotals = useMemo(() => {
    const debit = eLines.reduce((s, l) => s + num(l.debit), 0);
    const credit = eLines.reduce((s, l) => s + num(l.credit), 0);
    return { debit, credit, balanced: Math.abs(debit - credit) < 0.0001 };
  }, [eLines]);

  const resetEditor = () => {
    setMode("create");
    setEditingId(null);
    setEDate(new Date().toISOString().slice(0, 10));
    setEDesc("");
    setECreatedBy("admin");
    setELines([{ debit: 0, credit: 0 }]);
  };

  const openCreate = () => {
    resetEditor();
    setOpen(true);
  };

  const openEdit = (r: Entry) => {
    setMode("edit");
    setEditingId(r.id);
    setEDate(String(r.date).slice(0, 10));
    setEDesc(r.description || "");
    setECreatedBy(r.createdBy || "admin");
    setELines(
      (r.lines || []).map((l: any) => ({
        account_id: l.accountId || l.account_id || undefined,
        account_code: l.accountCode || l.account_code || undefined,
        debit: num(l.debit),
        credit: num(l.credit),
        reference_type: l.referenceType || undefined,
        reference_id: l.referenceId || undefined
      })) || [{ debit: 0, credit: 0 }]
    );
    if (!r.lines?.length) setELines([{ debit: 0, credit: 0 }]);
    setOpen(true);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const lines = eLines
      .map((l) => ({
        account_id: l.account_id || undefined,
        account_code: l.account_code || undefined,
        debit: num(l.debit),
        credit: num(l.credit),
        reference_type: l.reference_type || undefined,
        reference_id: l.reference_id || undefined
      }))
      .filter((l) => (l.account_id || l.account_code) && (l.debit > 0 || l.credit > 0));

    if (!lines.length) {
      notify("Add at least one Dr/Cr line with an account");
      return;
    }
    const td = lines.reduce((s, l) => s + l.debit, 0);
    const tc = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(td - tc) > 0.0001) {
      notify("Entry must be balanced (total Dr = total Cr)");
      return;
    }

    try {
      if (mode === "create") {
        await apiPost("/accounting/journal-entry", {
          date: eDate,
          description: eDesc.trim() || undefined,
          created_by: eCreatedBy.trim() || "admin",
          lines
        });
        notify("Journal entry created (draft)");
      } else if (editingId) {
        await apiPatch(`/accounting/journal-entry/${editingId}`, {
          date: eDate,
          description: eDesc.trim() || undefined,
          created_by: eCreatedBy.trim() || "admin",
          lines
        });
        notify("Journal entry updated");
      }
      setOpen(false);
      resetEditor();
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Save failed");
    }
  };

  const post = async (id: string) => {
    try {
      await apiPost(`/accounting/journal-entry/${id}/post`, {});
      notify("Posted");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to post");
    }
  };

  const unpost = async (id: string) => {
    try {
      await apiPost(`/accounting/journal-entry/${id}/unpost`, {});
      notify("Unposted");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to unpost");
    }
  };

  const exportCsv = () => {
    const header = ["date", "id", "description", "posted", "total_debit", "total_credit", "created_by"].join(",");
    const body = rows
      .map((r) =>
        [
          String(r.date).slice(0, 10),
          r.id,
          JSON.stringify(r.description || ""),
          r.postedAt ? "posted" : "draft",
          num(r.totalDebit).toFixed(2),
          num(r.totalCredit).toFixed(2),
          JSON.stringify(r.createdBy || "")
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `journal_entries_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Journal Entries"
        description="Create, edit, and post/unpost manual entries. Auto-posted entries are read-only."
        action={
          <div className="flex items-center gap-2">
            <button type="button" className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800" onClick={exportCsv}>
              <UploadCloud className="mr-2 inline h-4 w-4" />
              CSV
            </button>
            <button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={openCreate}>
              <Plus className="mr-2 inline h-4 w-4" />
              New
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <aside className="card p-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold">Filters</h3>
          </div>
          <div className="mt-3 space-y-3">
            <div>
              <label className="muted text-xs font-medium">Search</label>
              <input className="mt-1 w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Description, ref, user…" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="muted text-xs font-medium">From</label>
                <input className="mt-1 w-full" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="muted text-xs font-medium">To</label>
                <input className="mt-1 w-full" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="muted text-xs font-medium">Status</label>
              <select className="mt-1 w-full" value={posted} onChange={(e) => setPosted(e.target.value as any)}>
                <option value="">All</option>
                <option value="draft">Draft</option>
                <option value="posted">Posted</option>
              </select>
            </div>
            <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-black" onClick={() => void load()}>
              Apply
            </button>
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800"
              onClick={() => {
                setQ("");
                setPosted("");
                setDateFrom("");
                setDateTo("");
                void load();
              }}
            >
              Reset
            </button>
          </div>
        </aside>

        <section className="card overflow-hidden">
          <div className="border-b border-slate-200/60 p-3 text-sm dark:border-slate-700/60">
            <span className="muted">Showing</span> <span className="font-medium">{totals.count}</span> entries
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-900/40">
                <tr className="border-b border-slate-200/60 dark:border-slate-700/60">
                  <th className="p-3">Date</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Ref</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Debit</th>
                  <th className="p-3 text-right">Credit</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const isPosted = Boolean(r.postedAt);
                  const isAuto = Boolean(r.refType);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800/70">
                      <td className="p-3 font-mono text-xs">{String(r.date).slice(0, 10)}</td>
                      <td className="p-3">
                        <div className="font-medium">{r.description || "—"}</div>
                        <div className="muted text-xs">{r.createdBy || "—"}</div>
                      </td>
                      <td className="p-3 text-xs">
                        {r.refType ? (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                            {r.refType}:{String(r.refId || "").slice(0, 8)}
                          </span>
                        ) : (
                          <span className="muted">manual</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            isPosted ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                          )}
                        >
                          {isPosted ? "posted" : "draft"}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums">{num(r.totalDebit).toFixed(2)}</td>
                      <td className="p-3 text-right font-mono tabular-nums">{num(r.totalCredit).toFixed(2)}</td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          {!isAuto && !isPosted ? (
                            <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800" onClick={() => openEdit(r)}>
                              Edit
                            </button>
                          ) : null}
                          {!isPosted ? (
                            <button className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white" onClick={() => void post(r.id)}>
                              Post
                            </button>
                          ) : (
                            <button
                              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800"
                              disabled={isAuto}
                              onClick={() => void unpost(r.id)}
                              title={isAuto ? "Auto-posted entries cannot be unposted" : "Unpost"}
                            >
                              Unpost
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length ? (
                  <tr>
                    <td className="p-8 text-center text-sm text-slate-500" colSpan={7}>
                      No journal entries found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 border-t border-slate-200/60 bg-white p-3 text-sm dark:border-slate-700/60 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <span className="muted">Totals</span>
              <div className="flex items-center gap-6 font-mono tabular-nums">
                <span>Dr {totals.debit.toFixed(2)}</span>
                <span>Cr {totals.credit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      <DrawerPanel
        open={open}
        title={mode === "create" ? "New journal entry" : "Edit journal entry"}
        onClose={() => {
          setOpen(false);
          resetEditor();
        }}
        panelClassName="max-w-2xl"
      >
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs font-medium">Date</label>
              <input className="mt-1 w-full" type="date" value={eDate} onChange={(e) => setEDate(e.target.value)} required />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs font-medium">Description</label>
              <input className="mt-1 w-full" value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="e.g. Month-end accrual" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Created by</label>
            <input className="mt-1 w-full" value={eCreatedBy} onChange={(e) => setECreatedBy(e.target.value)} required />
          </div>

          <div className="card p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">Lines</h4>
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs dark:bg-slate-800"
                onClick={() => setELines((p) => [...p, { debit: 0, credit: 0 }])}
              >
                + Add line
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {eLines.map((l, idx) => (
                <div key={idx} className="grid gap-2 rounded-xl border border-slate-200/60 p-2 dark:border-slate-700/60 md:grid-cols-[1fr_120px_120px_40px]">
                  <div>
                    <label className="muted text-[10px] font-semibold uppercase">Account</label>
                    <select
                      className="mt-1 w-full"
                      value={l.account_id || ""}
                      onChange={(e) => {
                        const id = e.target.value || undefined;
                        const a = coa.find((x) => x.id === id);
                        setELines((p) => p.map((x, i) => (i === idx ? { ...x, account_id: id, account_code: a?.code } : x)));
                      }}
                    >
                      <option value="">Select account</option>
                      {coa.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="muted text-[10px] font-semibold uppercase">Dr</label>
                    <input
                      className="mt-1 w-full text-right font-mono"
                      type="number"
                      step="0.01"
                      min="0"
                      value={String(l.debit ?? 0)}
                      onChange={(e) => setELines((p) => p.map((x, i) => (i === idx ? { ...x, debit: num(e.target.value) } : x)))}
                    />
                  </div>
                  <div>
                    <label className="muted text-[10px] font-semibold uppercase">Cr</label>
                    <input
                      className="mt-1 w-full text-right font-mono"
                      type="number"
                      step="0.01"
                      min="0"
                      value={String(l.credit ?? 0)}
                      onChange={(e) => setELines((p) => p.map((x, i) => (i === idx ? { ...x, credit: num(e.target.value) } : x)))}
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      type="button"
                      className="rounded-lg bg-slate-100 px-2 py-2 text-xs dark:bg-slate-800"
                      onClick={() => setELines((p) => p.filter((_, i) => i !== idx))}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200/60 pt-3 text-sm dark:border-slate-700/60">
              <span className={cn("text-xs font-semibold", editorTotals.balanced ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
                {editorTotals.balanced ? "Balanced" : "Not balanced"}
              </span>
              <div className="flex items-center gap-6 font-mono tabular-nums">
                <span>Dr {editorTotals.debit.toFixed(2)}</span>
                <span>Cr {editorTotals.credit.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm dark:bg-slate-800"
              onClick={() => {
                setOpen(false);
                resetEditor();
              }}
            >
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white">
              <Save className="mr-2 inline h-4 w-4" />
              Save
            </button>
          </div>
        </form>
      </DrawerPanel>
    </div>
  );
}

