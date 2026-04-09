"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar
} from "recharts";
import { ChartCard } from "@/components/chart-card";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "@/components/data-table";
import { motion } from "framer-motion";
import { Plus, Download, RefreshCw } from "lucide-react";

const pieColors = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e"];

export type DashboardChartsProps = {
  salesSeries: Array<{ date: string; value: number }>;
  categorySeries: Array<{ name: string; value: number }>;
  hourlySeries: Array<{ hour: string; orders: number }>;
  topItems: Array<{ item_name: string; qty: number; revenue: number }>;
  timeline: Array<{ hour: string; orders: number; sales: number }>;
  onQuickAction: (label: string) => void;
};

export default function DashboardCharts({
  salesSeries,
  categorySeries,
  hourlySeries,
  topItems,
  timeline,
  onQuickAction
}: DashboardChartsProps) {
  const quickActions = [
    { label: "New Order", icon: Plus },
    { label: "Export Report", icon: Download },
    { label: "Refresh Data", icon: RefreshCw }
  ];

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Sales Line Chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={salesSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Category Pie Chart">
          {categorySeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categorySeries} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75}>
                  {categorySeries.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No category data" description="Create some orders to visualize category mix." />
          )}
        </ChartCard>
        <ChartCard title="Hourly Bar Chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlySeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="orders" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h3 className="mb-3 text-sm font-semibold">Quick Actions</h3>
          <div className="grid gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <motion.button
                  whileHover={{ y: -1 }}
                  key={action.label}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900"
                  onClick={() => onQuickAction(action.label)}
                >
                  <span>{action.label}</span>
                  <Icon className="h-4 w-4" />
                </motion.button>
              );
            })}
          </div>
        </div>
        <div className="lg:col-span-2">
          <DataTable
            data={topItems}
            columns={[
              { key: "name", header: "Top Items", render: (r) => r.item_name || "-" },
              { key: "qty", header: "Qty", render: (r) => Number(r.qty || 0).toFixed(0) },
              { key: "revenue", header: "Revenue", render: (r) => `$${Number(r.revenue || 0).toFixed(2)}` }
            ]}
          />
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold">Orders Timeline</h3>
        {timeline.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {timeline.slice(0, 8).map((t) => (
              <div key={t.hour} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <p className="muted text-xs">{t.hour}</p>
                <p className="mt-1 text-sm font-semibold">{t.orders} orders</p>
                <p className="muted text-xs">${t.sales.toFixed(2)} sales</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No order timeline" description="Timeline will populate once orders are available." />
        )}
      </div>
    </>
  );
}
