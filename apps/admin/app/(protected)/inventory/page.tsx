"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { StatCard } from "@/components/stat-card";
import { useToast } from "@/components/toast";

type Insights = {
  total_stock_value: number;
  valuation: Array<{ name: string; line_value: number; low_stock: boolean }>;
  consumption_by_day: Array<{ date: string; qty: number }>;
  top_consumed: Array<{ name: string; qty: number }>;
};

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#94a3b8"];

export default function InventoryOverviewPage() {
  const { notify } = useToast();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = (await apiGet("/inventory/insights")) as Insights;
        setInsights(data);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Failed to load inventory insights");
      } finally {
        setLoading(false);
      }
    })();
  }, [notify]);

  const lowCount = insights?.valuation.filter((v) => v.low_stock).length ?? 0;
  const pieData =
    insights?.valuation
      .filter((v) => v.line_value > 0)
      .sort((a, b) => b.line_value - a.line_value)
      .slice(0, 6)
      .map((v) => ({ name: v.name.length > 18 ? `${v.name.slice(0, 18)}…` : v.name, value: v.line_value })) ?? [];

  if (loading) {
    return <p className="muted py-12 text-center text-sm">Loading inventory…</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" description="Stock value, consumption, and alerts across your branch." />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Est. stock value"
          value={insights ? `$${insights.total_stock_value.toLocaleString()}` : "—"}
          hint="From last PO unit prices × on-hand"
        />
        <StatCard label="Low / reorder SKUs" value={String(lowCount)} hint="At or below reorder point" />
        <StatCard
          label="Consumption (30d)"
          value={insights ? String(insights.consumption_by_day.reduce((s, d) => s + d.qty, 0).toFixed(0)) : "—"}
          hint="Deductions from stock ledger"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Consumption trend (30 days)" subtitle="Total units deducted per day" contentClassName="h-64">
          <ResponsiveContainer width="100%" height="100%">
              <BarChart data={insights?.consumption_by_day ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="qty" fill="#6366f1" radius={[4, 4, 0, 0]} name="Qty" />
              </BarChart>
            </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Stock value mix" subtitle="Top items by estimated line value" contentClassName="h-64">
          {pieData.length ? (
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={88} label={({ name }) => name}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center muted text-sm">Add PO receipts to build value data.</p>
            )}
        </ChartCard>
      </div>

      <ChartCard title="Top consumed ingredients (30 days)" subtitle="From stock ledger deductions" contentClassName="h-72">
        <ResponsiveContainer width="100%" height="100%">
            <BarChart data={insights?.top_consumed ?? []} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="qty" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="Units" />
            </BarChart>
          </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
