"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";

type Plan = {
  id: string;
  code: string;
  name: string;
  trialDays: number;
  priceMonthly: number;
  priceYearly: number;
  maxConcepts: number;
  maxBranches: number;
  maxDevices: number;
  maxUsers: number;
  maxItems: number;
  isActive: boolean;
};

const emptyForm = {
  name: "",
  code: "",
  trial_days: 14,
  price_monthly: 0,
  price_yearly: 0,
  max_branches: 1,
  max_concepts: 1,
  max_devices: 3,
  max_users: 5,
  max_items: 1000,
  is_active: true
};

export default function SuperAdminPlansPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Plan[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const load = async () => {
    const r = await apiGet("/super-admin/plans");
    setRows(Array.isArray(r) ? r : []);
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plans"
        description="Subscription plans, pricing, and limits."
        action={
          <button
            className="bg-indigo-600 text-white"
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm });
              setOpen(true);
            }}
          >
            Create plan
          </button>
        }
      />
      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">Plan name</th>
              <th className="py-2">Price</th>
              <th className="py-2">Trial days</th>
              <th className="py-2">Max branches</th>
              <th className="py-2">Max devices</th>
              <th className="py-2">Max users</th>
              <th className="py-2">Active</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">
                  <div className="font-medium">{p.name}</div>
                  <div className="muted text-xs">{p.code}</div>
                </td>
                <td className="py-2">${Number(p.priceMonthly || 0).toFixed(2)} / ${Number(p.priceYearly || 0).toFixed(2)}</td>
                <td className="py-2">{p.trialDays}</td>
                <td className="py-2">{p.maxBranches}</td>
                <td className="py-2">{p.maxDevices}</td>
                <td className="py-2">{p.maxUsers}</td>
                <td className="py-2">
                  <button
                    className={`rounded px-2 py-0.5 text-xs ${p.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}
                    onClick={async () => {
                      await apiPatch(`/super-admin/plans/${p.id}`, { is_active: !p.isActive });
                      await load();
                    }}
                  >
                    {p.isActive ? "On" : "Off"}
                  </button>
                </td>
                <td className="py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      className="bg-slate-100 text-xs dark:bg-slate-800"
                      onClick={() => {
                        setEditing(p);
                        setForm({
                          name: p.name,
                          code: p.code,
                          trial_days: p.trialDays,
                          price_monthly: Number(p.priceMonthly || 0),
                          price_yearly: Number(p.priceYearly || 0),
                          max_branches: p.maxBranches,
                          max_concepts: p.maxConcepts,
                          max_devices: p.maxDevices,
                          max_users: p.maxUsers,
                          max_items: p.maxItems,
                          is_active: p.isActive
                        });
                        setOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="bg-slate-100 text-xs dark:bg-slate-800"
                      onClick={async () => {
                        const copy = {
                          name: `${p.name} Copy`,
                          code: `${p.code}_copy_${Math.floor(Math.random() * 1000)}`,
                          trial_days: p.trialDays,
                          price_monthly: Number(p.priceMonthly || 0),
                          price_yearly: Number(p.priceYearly || 0),
                          max_branches: p.maxBranches,
                          max_concepts: p.maxConcepts,
                          max_devices: p.maxDevices,
                          max_users: p.maxUsers,
                          max_items: p.maxItems,
                          is_active: false
                        };
                        await apiPost("/super-admin/plans", copy);
                        notify("Plan duplicated");
                        await load();
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      className="bg-amber-600 text-xs text-white"
                      onClick={async () => {
                        await apiPatch(`/super-admin/plans/${p.id}`, { is_active: false });
                        notify("Plan disabled");
                        await load();
                      }}
                    >
                      Disable
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DrawerPanel
        open={open}
        title={editing ? "Edit plan" : "Create plan"}
        onClose={() => setOpen(false)}
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Name</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-medium">Code</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Trial days</label>
              <input type="number" value={form.trial_days} onChange={(e) => setForm((f) => ({ ...f, trial_days: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Max items</label>
              <input type="number" value={form.max_items} onChange={(e) => setForm((f) => ({ ...f, max_items: Number(e.target.value || 1) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Price monthly</label>
              <input type="number" step="0.01" value={form.price_monthly} onChange={(e) => setForm((f) => ({ ...f, price_monthly: Number(e.target.value || 0) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Price yearly</label>
              <input type="number" step="0.01" value={form.price_yearly} onChange={(e) => setForm((f) => ({ ...f, price_yearly: Number(e.target.value || 0) }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Max branches</label>
              <input type="number" value={form.max_branches} onChange={(e) => setForm((f) => ({ ...f, max_branches: Number(e.target.value || 1) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Max concepts</label>
              <input type="number" value={form.max_concepts} onChange={(e) => setForm((f) => ({ ...f, max_concepts: Number(e.target.value || 1) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Max devices</label>
              <input type="number" value={form.max_devices} onChange={(e) => setForm((f) => ({ ...f, max_devices: Number(e.target.value || 1) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Max users</label>
              <input type="number" value={form.max_users} onChange={(e) => setForm((f) => ({ ...f, max_users: Number(e.target.value || 1) }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
          <button
            className="w-full bg-indigo-600 text-white"
            onClick={async () => {
              if (editing) {
                await apiPatch(`/super-admin/plans/${editing.id}`, form);
                notify("Plan updated");
              } else {
                await apiPost("/super-admin/plans", form);
                notify("Plan created");
              }
              setOpen(false);
              await load();
            }}
          >
            {editing ? "Save changes" : "Create plan"}
          </button>
        </div>
      </DrawerPanel>
    </div>
  );
}

