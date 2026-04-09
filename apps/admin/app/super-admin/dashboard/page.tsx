"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet } from "@/lib/api";

export default function SuperAdminDashboardPage() {
  const [totals, setTotals] = useState({
    tenants: 0,
    active_subscriptions: 0,
    active_plans: 0,
    tenant_users: 0,
    devices: 0
  });

  useEffect(() => {
    void (async () => {
      const r = await apiGet("/super-admin/dashboard");
      setTotals(r?.totals || totals);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Owner Dashboard" description="Platform-level KPIs across all tenants." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Object.entries(totals).map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="muted text-xs uppercase">{k.replaceAll("_", " ")}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

