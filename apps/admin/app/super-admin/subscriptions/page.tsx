"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/components/toast";

type TrialRow = {
  tenant_id: string;
  tenant: string;
  trial_start: string;
  trial_end: string | null;
  days_left: number | null;
  plan: string;
  status: string;
  converted_to_paid: boolean;
};

export default function SuperAdminSubscriptionsPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<TrialRow[]>([]);
  const [widgets, setWidgets] = useState({
    expiring_today: 0,
    expiring_in_7_days: 0,
    expired_trials: 0,
    converted_to_paid: 0
  });
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const load = async () => {
    const r = await apiGet("/super-admin/trials");
    setRows(Array.isArray(r?.data) ? r.data : []);
    setWidgets(
      r?.widgets || {
        expiring_today: 0,
        expiring_in_7_days: 0,
        expired_trials: 0,
        converted_to_paid: 0
      }
    );
  };

  useEffect(() => {
    void load();
  }, []);

  const selectedIds = useMemo(
    () => Object.entries(selected).filter(([, v]) => v).map(([k]) => k),
    [selected]
  );

  const extendOne = async (tenantId: string, days = 7) => {
    await apiPost(`/super-admin/trials/${tenantId}/extend`, { extend_days: days });
    notify(`Trial extended by ${days} days`);
    await load();
  };

  const convertOne = async (tenantId: string) => {
    await apiPost(`/super-admin/trials/${tenantId}/convert`, {});
    notify("Converted to paid");
    await load();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trial Management"
        description="Monitor trial lifecycle, conversions, and expiry operations."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <p className="muted text-xs uppercase">Trials expiring today</p>
          <p className="mt-1 text-2xl font-semibold">{widgets.expiring_today}</p>
        </div>
        <div className="card p-4">
          <p className="muted text-xs uppercase">Trials expiring in 7 days</p>
          <p className="mt-1 text-2xl font-semibold">{widgets.expiring_in_7_days}</p>
        </div>
        <div className="card p-4">
          <p className="muted text-xs uppercase">Expired trials</p>
          <p className="mt-1 text-2xl font-semibold">{widgets.expired_trials}</p>
        </div>
        <div className="card p-4">
          <p className="muted text-xs uppercase">Converted to paid</p>
          <p className="mt-1 text-2xl font-semibold">{widgets.converted_to_paid}</p>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <button
          className="bg-indigo-600 text-white"
          disabled={selectedIds.length === 0}
          onClick={async () => {
            for (const id of selectedIds) await apiPost(`/super-admin/trials/${id}/extend`, { extend_days: 7 });
            notify(`Extended ${selectedIds.length} tenant(s)`);
            setSelected({});
            await load();
          }}
        >
          Extend selected
        </button>
        <button
          className="bg-amber-600 text-white"
          disabled={selectedIds.length === 0}
          onClick={async () => {
            for (const id of selectedIds) await apiPost(`/super-admin/tenants/${id}/suspend`, {});
            notify(`Suspended ${selectedIds.length} tenant(s)`);
            setSelected({});
            await load();
          }}
        >
          Suspend selected
        </button>
      </div>

      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={(e) => {
                    const v = e.target.checked;
                    const next: Record<string, boolean> = {};
                    for (const r of rows) next[r.tenant_id] = v;
                    setSelected(next);
                  }}
                />
              </th>
              <th className="py-2">Tenant</th>
              <th className="py-2">Trial start</th>
              <th className="py-2">Trial end</th>
              <th className="py-2">Days left</th>
              <th className="py-2">Plan</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tenant_id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">
                  <input
                    type="checkbox"
                    checked={!!selected[r.tenant_id]}
                    onChange={(e) => setSelected((s) => ({ ...s, [r.tenant_id]: e.target.checked }))}
                  />
                </td>
                <td className="py-2 font-medium">{r.tenant}</td>
                <td className="py-2">{new Date(r.trial_start).toLocaleDateString()}</td>
                <td className="py-2">{r.trial_end ? new Date(r.trial_end).toLocaleDateString() : "-"}</td>
                <td className="py-2">{r.days_left ?? "-"}</td>
                <td className="py-2">{r.plan}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">
                  <div className="flex justify-end gap-1">
                    <button className="bg-slate-100 text-xs dark:bg-slate-800" onClick={() => void extendOne(r.tenant_id, 7)}>
                      Extend trial
                    </button>
                    <button className="bg-emerald-600 text-xs text-white" onClick={() => void convertOne(r.tenant_id)}>
                      Convert to paid
                    </button>
                    <button className="bg-amber-600 text-xs text-white" onClick={async () => {
                      await apiPost(`/super-admin/tenants/${r.tenant_id}/suspend`, {});
                      notify("Tenant suspended");
                      await load();
                    }}>
                      Suspend expired
                    </button>
                    <button className="bg-slate-100 text-xs dark:bg-slate-800" onClick={() => notify("Reminder email sent")}>
                      Send reminder email
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

