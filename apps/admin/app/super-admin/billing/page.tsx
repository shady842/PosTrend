"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPost } from "@/lib/api";
import { useToast } from "@/components/toast";

type Row = {
  tenant_id: string;
  tenant: string;
  plan_id: string | null;
  plan: string;
  amount: number;
  billing_cycle: string;
  next_billing_date: string | null;
  status: string;
};

export default function SuperAdminBillingPage() {
  const { notify } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    tenant_id: "",
    plan_id: "",
    billing_cycle: "monthly",
    amount: 0
  });

  const load = async () => {
    const [subs, t, p] = await Promise.all([
      apiGet("/super-admin/subscriptions"),
      apiGet("/super-admin/tenants"),
      apiGet("/super-admin/plans")
    ]);
    setRows(Array.isArray(subs?.table) ? subs.table : []);
    setInvoices(Array.isArray(subs?.invoices) ? subs.invoices : []);
    const tenantsMapped = Array.isArray(t) ? t.map((x: any) => ({ id: x.id, name: x.name })) : [];
    const plansMapped = Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : [];
    setTenants(tenantsMapped);
    setPlans(plansMapped);
    if (!form.tenant_id && tenantsMapped[0]) setForm((f) => ({ ...f, tenant_id: tenantsMapped[0].id }));
    if (!form.plan_id && plansMapped[0]) setForm((f) => ({ ...f, plan_id: plansMapped[0].id }));
  };

  useEffect(() => {
    void load();
  }, []);

  const paymentSummary = useMemo(() => {
    const byStatus = new Map<string, number>();
    for (const i of invoices) byStatus.set(i.status, (byStatus.get(i.status) || 0) + 1);
    return [...byStatus.entries()].map(([status, count]) => ({ status, count }));
  }, [invoices]);

  return (
    <div className="space-y-4">
      <PageHeader title="Billing" description="Billing control panel for subscriptions, invoices, and payment status." />

      <div className="card space-y-3 p-4">
        <h3 className="text-sm font-semibold">Manual subscription assign / change plan</h3>
        <div className="grid gap-2 md:grid-cols-4">
          <select value={form.tenant_id} onChange={(e) => setForm((f) => ({ ...f, tenant_id: e.target.value }))}>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select value={form.plan_id} onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={form.billing_cycle} onChange={(e) => setForm((f) => ({ ...f, billing_cycle: e.target.value }))}>
            <option value="monthly">monthly</option>
            <option value="yearly">yearly</option>
          </select>
          <input type="number" placeholder="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: Number(e.target.value || 0) }))} />
        </div>
        <button
          className="bg-indigo-600 text-white"
          onClick={async () => {
            await apiPost("/super-admin/subscriptions/change", form);
            notify("Subscription changed");
            await load();
          }}
        >
          Apply subscription
        </button>
      </div>

      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">Tenant</th>
              <th className="py-2">Plan</th>
              <th className="py-2">Amount</th>
              <th className="py-2">Billing cycle</th>
              <th className="py-2">Next billing date</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tenant_id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">{r.tenant}</td>
                <td className="py-2">{r.plan}</td>
                <td className="py-2">${Number(r.amount || 0).toFixed(2)}</td>
                <td className="py-2">{r.billing_cycle}</td>
                <td className="py-2">{r.next_billing_date ? new Date(r.next_billing_date).toLocaleDateString() : "-"}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">
                  <div className="flex justify-end gap-1">
                    <button
                      className="bg-emerald-600 text-xs text-white"
                      onClick={async () => {
                        await apiPost("/super-admin/subscriptions/change", {
                          tenant_id: r.tenant_id,
                          plan_id: r.plan_id || plans[0]?.id,
                          billing_cycle: "yearly"
                        });
                        notify("Upgraded");
                        await load();
                      }}
                    >
                      Upgrade
                    </button>
                    <button
                      className="bg-amber-600 text-xs text-white"
                      onClick={async () => {
                        await apiPost("/super-admin/subscriptions/change", {
                          tenant_id: r.tenant_id,
                          plan_id: r.plan_id || plans[0]?.id,
                          billing_cycle: "monthly"
                        });
                        notify("Downgraded");
                        await load();
                      }}
                    >
                      Downgrade
                    </button>
                    <button
                      className="bg-rose-700 text-xs text-white"
                      onClick={async () => {
                        await apiPost("/super-admin/subscriptions/cancel", { tenant_id: r.tenant_id });
                        notify("Cancelled");
                        await load();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="bg-indigo-600 text-xs text-white"
                      onClick={async () => {
                        await apiPost("/super-admin/subscriptions/change", {
                          tenant_id: r.tenant_id,
                          plan_id: r.plan_id || plans[0]?.id,
                          billing_cycle: r.billing_cycle || "monthly"
                        });
                        notify("Renewed");
                        await load();
                      }}
                    >
                      Renew
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Invoice list</h3>
          <div className="space-y-1 text-sm">
            {invoices.slice(0, 20).map((i) => (
              <div key={i.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                <span>{i.tenant} - {i.plan}</span>
                <span className="muted">${Number(i.amount || 0).toFixed(2)} ({i.cycle})</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-2 text-sm font-semibold">Payment status</h3>
          <div className="space-y-1 text-sm">
            {paymentSummary.map((s) => (
              <div key={s.status} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                <span>{s.status}</span>
                <span>{s.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

