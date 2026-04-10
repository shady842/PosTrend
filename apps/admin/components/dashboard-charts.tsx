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
  Bar,
  Legend
} from "recharts";
import { ChartCard } from "@/components/chart-card";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "@/components/data-table";

const pieColors = ["#6366f1", "#0ea5e9", "#f59e0b", "#10b981", "#f43f5e"];

export type DashboardChartsProps = {
  salesSeries: Array<{ date: string; value: number }>;
  categorySeries: Array<{ name: string; value: number }>;
  hourlySeries: Array<{ hour: string; invoices: number; sales: number }>;
  cashierSeries: Array<{ user: string; orders: number; sales: number }>;
  paymentMethodSeries: Array<{ method: string; count: number; amount: number }>;
  topItems: Array<{ item_name: string; qty: number; revenue: number }>;
  timeline: Array<{ hour: string; orders: number; sales: number }>;
  invoiceSeries: Array<{ invoice_no: string; opened_at: string; order_type: string; status: string; total: number }>;
};

export default function DashboardCharts({
  salesSeries,
  categorySeries,
  hourlySeries,
  cashierSeries,
  paymentMethodSeries,
  topItems,
  timeline,
  invoiceSeries
}: DashboardChartsProps) {
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
        <ChartCard title="Hourly Sales & Invoices">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourlySeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="invoices" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
              <Bar dataKey="sales" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Payment Methods">
          {paymentMethodSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMethodSeries} dataKey="amount" nameKey="method" innerRadius={42} outerRadius={78}>
                  {paymentMethodSeries.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `$${Number(v || 0).toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No payment data" description="Payments by method will appear once checks are paid." />
          )}
        </ChartCard>
        <ChartCard title="Top Cashiers (Sales)">
          {cashierSeries.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashierSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user" />
                <YAxis />
                <Tooltip formatter={(v) => `$${Number(v || 0).toFixed(2)}`} />
                <Bar dataKey="sales" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No cashier data" description="Cashier performance appears after orders are posted." />
          )}
        </ChartCard>
        <div className="lg:col-span-1">
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

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 card p-4">
          <h3 className="mb-3 text-sm font-semibold">Invoice-wise Sales</h3>
          <DataTable
            data={invoiceSeries}
            columns={[
              { key: "invoice_no", header: "Invoice", render: (r) => r.invoice_no || "-" },
              { key: "opened_at", header: "Time", render: (r) => new Date(r.opened_at).toLocaleString() },
              { key: "order_type", header: "Type", render: (r) => r.order_type || "-" },
              { key: "status", header: "Status", render: (r) => r.status || "-" },
              { key: "total", header: "Total", render: (r) => `$${Number(r.total || 0).toFixed(2)}` }
            ]}
          />
        </div>
        <div className="lg:col-span-1 card p-4">
          <h3 className="mb-3 text-sm font-semibold">Latest Invoice Totals</h3>
          {invoiceSeries.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={invoiceSeries.slice(0, 12).reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="invoice_no" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No invoice data" description="Invoice-level sales appear after orders are opened." />
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold">Orders Timeline</h3>
        {timeline.length ? (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {timeline.slice(0, 12).map((t) => (
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
