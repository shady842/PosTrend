"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };
type Section = { id: string; name: string };
type TableRow = {
  id: string;
  floorId: string;
  name: string;
  seats: number;
  isActive: boolean;
  status: "available" | "occupied" | "reserved" | "inactive";
  active_order_number?: string | null;
};

type TablePosition = { x: number; y: number };

export default function TableLayoutPage() {
  const { notify } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [sections, setSections] = useState<Section[]>([]);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [sectionForm, setSectionForm] = useState({ name: "" });
  const [tableForm, setTableForm] = useState({ floor_id: "", name: "", seats: "2" });
  const [loading, setLoading] = useState(false);
  const [positions, setPositions] = useState<Record<string, TablePosition>>({});
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const load = useCallback(async (bid: string) => {
    if (!bid) return;
    setLoading(true);
    try {
      const [secRows, tableRows] = await Promise.all([
        apiGet(`/pos/orders/sections?branch_id=${encodeURIComponent(bid)}`),
        apiGet(`/pos/orders/tables?branch_id=${encodeURIComponent(bid)}`)
      ]);
      const s = Array.isArray(secRows) ? secRows : [];
      setSections(s);
      setTableForm((f) => ({ ...f, floor_id: f.floor_id || s[0]?.id || "" }));
      setTables(Array.isArray(tableRows) ? tableRows : []);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load table layout");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = (await apiGet("/branches")) as Branch[];
        setBranches(Array.isArray(rows) ? rows : []);
        const preset = localStorage.getItem("pt_branch_id") || rows?.[0]?.id || "";
        setBranchId(preset);
        if (preset) void load(preset);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Failed to load branches");
      }
    })();
  }, [load, notify]);

  useEffect(() => {
    if (!branchId) return;
    const key = `table_layout_positions_${branchId}`;
    try {
      const raw = localStorage.getItem(key);
      setPositions(raw ? (JSON.parse(raw) as Record<string, TablePosition>) : {});
    } catch {
      setPositions({});
    }
  }, [branchId]);

  const tablesBySection = useMemo(() => {
    const m: Record<string, TableRow[]> = {};
    sections.forEach((s) => { m[s.id] = []; });
    tables.forEach((t) => {
      if (!m[t.floorId]) m[t.floorId] = [];
      m[t.floorId].push(t);
    });
    return m;
  }, [sections, tables]);

  const savePosition = (tableId: string, pos: TablePosition) => {
    const next = { ...positions, [tableId]: pos };
    setPositions(next);
    if (branchId) localStorage.setItem(`table_layout_positions_${branchId}`, JSON.stringify(next));
  };

  const statusClass = (status: TableRow["status"]) => {
    if (status === "occupied") return "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200";
    if (status === "reserved") return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200";
    if (status === "inactive") return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200";
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200";
  };

  const createSection = async () => {
    if (!branchId || !sectionForm.name.trim()) return;
    try {
      await apiPost("/pos/orders/sections", { name: sectionForm.name.trim(), branch_id: branchId });
      setSectionForm({ name: "" });
      await load(branchId);
      notify("Section created");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to create section");
    }
  };

  const createTable = async () => {
    if (!tableForm.floor_id || !tableForm.name.trim()) return;
    try {
      await apiPost("/pos/orders/tables", {
        floor_id: tableForm.floor_id,
        name: tableForm.name.trim(),
        seats: parseInt(tableForm.seats, 10) || 2
      });
      setTableForm((f) => ({ ...f, name: "", seats: "2" }));
      await load(branchId);
      notify("Table created");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to create table");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Sections & Table Layout"
        description="Create dining sections and tables, manage seats and active/inactive states, and monitor occupancy."
      />

      <div className="card grid gap-3 p-4 md:grid-cols-3">
        <div>
          <label className="text-xs font-medium">Branch</label>
          <select
            value={branchId}
            onChange={(e) => {
              const v = e.target.value;
              setBranchId(v);
              localStorage.setItem("pt_branch_id", v);
              void load(v);
            }}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">New section</label>
          <div className="flex gap-2">
            <input value={sectionForm.name} onChange={(e) => setSectionForm({ name: e.target.value })} placeholder="Indoor / Terrace / VIP" />
            <button type="button" className="bg-indigo-600 text-white" onClick={() => void createSection()}>
              Add
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium">New table</label>
          <div className="grid grid-cols-3 gap-2">
            <select value={tableForm.floor_id} onChange={(e) => setTableForm((f) => ({ ...f, floor_id: e.target.value }))}>
              <option value="">Section</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input value={tableForm.name} onChange={(e) => setTableForm((f) => ({ ...f, name: e.target.value }))} placeholder="T-01" />
            <input type="number" min={1} value={tableForm.seats} onChange={(e) => setTableForm((f) => ({ ...f, seats: e.target.value }))} />
          </div>
          <button type="button" className="mt-2 bg-slate-900 text-white dark:bg-indigo-600" onClick={() => void createTable()}>
            Create table
          </button>
        </div>
      </div>

      {loading ? <div className="card p-6 text-sm muted">Loading layout...</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {sections.map((s) => (
          <section key={s.id} className="card space-y-3 p-4">
            <div className="flex items-center justify-between gap-2">
              <input
                defaultValue={s.name}
                className="max-w-[220px]"
                onBlur={async (e) => {
                  const v = e.target.value.trim();
                  if (!v || v === s.name) return;
                  try {
                    await apiPatch(`/pos/orders/sections/${s.id}`, { name: v });
                    await load(branchId);
                    notify("Section updated");
                  } catch (err) {
                    notify(err instanceof Error ? err.message : "Failed to update section");
                  }
                }}
              />
              <span className="text-xs muted">{tablesBySection[s.id]?.length || 0} tables</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(tablesBySection[s.id] || []).map((t) => (
                <article key={t.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      defaultValue={t.name}
                      className="w-24 text-sm"
                      onBlur={async (e) => {
                        const v = e.target.value.trim();
                        if (!v || v === t.name) return;
                        try {
                          await apiPatch(`/pos/orders/tables/${t.id}`, { name: v });
                          await load(branchId);
                          notify("Table updated");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Failed to update table");
                        }
                      }}
                    />
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass(t.status)}`}>
                      {t.status}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs muted">
                    <span>Seats: {t.seats}</span>
                    {t.active_order_number ? <span>Order: {t.active_order_number}</span> : null}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min={1}
                      defaultValue={t.seats}
                      onBlur={async (e) => {
                        const seats = parseInt(e.target.value, 10);
                        if (!Number.isFinite(seats) || seats <= 0 || seats === t.seats) return;
                        try {
                          await apiPatch(`/pos/orders/tables/${t.id}`, { seats });
                          await load(branchId);
                          notify("Seats updated");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Failed to update seats");
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={t.isActive ? "bg-slate-900 text-white dark:bg-slate-700" : "bg-emerald-600 text-white"}
                      onClick={async () => {
                        try {
                          await apiPatch(`/pos/orders/tables/${t.id}`, { is_active: !t.isActive });
                          await load(branchId);
                          notify("Table state updated");
                        } catch (err) {
                          notify(err instanceof Error ? err.message : "Failed to update table state");
                        }
                      }}
                    >
                      {t.isActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </article>
              ))}
              {!tablesBySection[s.id]?.length ? (
                <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs muted dark:border-slate-700">
                  No tables in this section.
                </div>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Visual Floor Layout</h3>
          <p className="text-xs muted">Drag tables to arrange floor map (saved per branch)</p>
        </div>
        {sections.map((s) => (
          <section key={`canvas-${s.id}`} className="space-y-2">
            <h4 className="text-xs font-semibold uppercase text-slate-500">{s.name}</h4>
            <div
              className="relative h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
              onMouseMove={(e) => {
                if (!draggingId) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const x = Math.max(8, Math.min(rect.width - 80, e.clientX - rect.left - 36));
                const y = Math.max(8, Math.min(rect.height - 48, e.clientY - rect.top - 20));
                savePosition(draggingId, { x, y });
              }}
              onMouseUp={() => setDraggingId(null)}
              onMouseLeave={() => setDraggingId(null)}
            >
              {(tablesBySection[s.id] || []).map((t) => {
                const p = positions[t.id] || { x: 12, y: 12 };
                return (
                  <button
                    key={`map-${t.id}`}
                    type="button"
                    className={`absolute min-w-[72px] rounded-lg px-2 py-1 text-xs shadow ${statusClass(t.status)}`}
                    style={{ left: p.x, top: p.y }}
                    onMouseDown={() => setDraggingId(t.id)}
                    onDoubleClick={() => {
                      const np = { x: 12, y: 12 };
                      savePosition(t.id, np);
                    }}
                    title={`Table ${t.name} (${t.seats} seats)`}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

