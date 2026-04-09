"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";

export default function SuperAdminUsagePage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [data, setData] = useState<any>({
    metrics: {
      total_tenants: 0,
      active_tenants: 0,
      trials: 0,
      mrr: 0,
      arr: 0,
      active_devices: 0,
      orders_per_day: 0,
      api_calls: 0
    },
    charts: { tenants_growth: [], revenue_growth: [], plan_distribution: [], usage_per_tenant: [] },
    table: []
  });

  const load = async () => {
    const q = new URLSearchParams({
      date_from: dateFrom,
      date_to: dateTo,
      plan,
      status
    });
    const [u, p] = await Promise.all([
      apiGet(`/super-admin/usage?${q.toString()}`),
      apiGet("/super-admin/plans")
    ]);
    setData(u || data);
    setPlans(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : []);
  };

  useEffect(() => {
    void load();
  }, []);

  const cards = useMemo(
    () => [
      { k: "Total tenants", v: data.metrics.total_tenants },
      { k: "Active tenants", v: data.metrics.active_tenants },
      { k: "Trials", v: data.metrics.trials },
      { k: "MRR", v: `$${Number(data.metrics.mrr || 0).toFixed(2)}` },
      { k: "ARR", v: `$${Number(data.metrics.arr || 0).toFixed(2)}` },
      { k: "Active devices", v: data.metrics.active_devices },
      { k: "Orders per day", v: data.metrics.orders_per_day },
      { k: "API calls", v: data.metrics.api_calls }
    ],
    [data.metrics]
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Usage Analytics" description="SaaS platform usage, growth, and operational metrics." />

      <div className="card grid gap-2 p-3 md:grid-cols-5">
        <div>
          <label className="text-xs">Date from</label>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div>
          <label className="text-xs">Date to</label>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <div>
          <label className="text-xs">Plan</label>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="all">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All status</option>
            <option value="trial">trial</option>
            <option value="active">active</option>
            <option value="past_due">past_due</option>
            <option value="suspended">suspended</option>
            <option value="cancelled">cancelled</option>
          </select>
        </div>
        <div className="flex items-end">
          <button className="w-full bg-indigo-600 text-white" onClick={() => void load()}>
            Apply filters
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.k} className="card p-4">
            <p className="muted text-xs uppercase">{c.k}</p>
            <p className="mt-1 text-2xl font-semibold">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">Tenants growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.tenants_growth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">Revenue growth</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.revenue_growth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">Plan distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.charts.plan_distribution} dataKey="value" nameKey="name" outerRadius={90} fill="#6366f1" label />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold">Usage per tenant</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.usage_per_tenant}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenant" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="devices" fill="#6366f1" />
                <Bar dataKey="orders" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto p-4">
        <h3 className="mb-3 text-sm font-semibold">Tenant usage</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">Tenant</th>
              <th className="py-2">Branches</th>
              <th className="py-2">Devices</th>
              <th className="py-2">Orders</th>
              <th className="py-2">Storage</th>
              <th className="py-2">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {(data.table || []).map((r: any) => (
              <tr key={r.tenant} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">{r.tenant}</td>
                <td className="py-2">{r.branches}</td>
                <td className="py-2">{r.devices}</td>
                <td className="py-2">{r.orders}</td>
                <td className="py-2">{r.storage_mb} MB</td>
                <td className="py-2">{r.last_activity ? new Date(r.last_activity).toLocaleString() : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

