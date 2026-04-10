"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, animate, useMotionValue, useTransform } from "framer-motion";
import { Radio } from "lucide-react";
import { apiGet } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { useToast } from "@/components/toast";
import type { DashboardChartsProps } from "@/components/dashboard-charts";
import { useAdminTenantRealtime } from "@/hooks/use-admin-tenant-realtime";
import { cn } from "@/lib/utils";

const DashboardCharts = dynamic(() => import("@/components/dashboard-charts"), {
  ssr: false,
  loading: () => (
    <div className="grid gap-4 lg:grid-cols-3">
      <LoadingSkeleton />
      <LoadingSkeleton />
      <LoadingSkeleton />
    </div>
  )
});

export default function DashboardPage() {
  const { notify } = useToast();
  const [stats, setStats] = useState({
    salesToday: 0,
    ordersCount: 0,
    avgOrderValue: 0,
    topItemsCount: 0
  });
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [salesSeries, setSalesSeries] = useState<DashboardChartsProps["salesSeries"]>([]);
  const [hourlySeries, setHourlySeries] = useState<DashboardChartsProps["hourlySeries"]>([]);
  const [categorySeries, setCategorySeries] = useState<DashboardChartsProps["categorySeries"]>([]);
  const [topItems, setTopItems] = useState<DashboardChartsProps["topItems"]>([]);
  const [timeline, setTimeline] = useState<DashboardChartsProps["timeline"]>([]);
  const [cashierSeries, setCashierSeries] = useState<DashboardChartsProps["cashierSeries"]>([]);
  const [paymentMethodSeries, setPaymentMethodSeries] = useState<DashboardChartsProps["paymentMethodSeries"]>([]);
  const [invoiceSeries, setInvoiceSeries] = useState<DashboardChartsProps["invoiceSeries"]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [liveOps, setLiveOps] = useState({
    active_orders: 0,
    kds_tickets: 0,
    occupied_tables: 0
  });

  const loadDashboard = useCallback(
    async (branchId?: string, opts?: { quiet?: boolean }) => {
      const quiet = opts?.quiet === true;
      if (!quiet) {
        setDataLoading(true);
      }
      try {
        const liveQ =
          branchId && branchId.length > 0
            ? `?branch_id=${encodeURIComponent(branchId)}`
            : "";
        const [branchRows, salesResp, hourlyResp, invoiceResp, itemsResp, cashierResp, paymentResp, liveResp] = await Promise.all([
          apiGet("/branches"),
          apiGet(`/reports/sales?page=1&page_size=300${branchId ? `&branch_id=${branchId}` : ""}`),
          apiGet(`/reports/hourly-sales?page=1&page_size=24${branchId ? `&branch_id=${branchId}` : ""}`),
          apiGet(`/reports/invoice-sales?page=1&page_size=50${branchId ? `&branch_id=${branchId}` : ""}`),
          apiGet(`/reports/items?page=1&page_size=50${branchId ? `&branch_id=${branchId}` : ""}`),
          apiGet(`/reports/cashier?page=1&page_size=20${branchId ? `&branch_id=${branchId}` : ""}`),
          apiGet(`/reports/payment-methods?page=1&page_size=20${branchId ? `&branch_id=${branchId}` : ""}`),
          apiGet(`/reports/live${liveQ}`).catch(() => null)
        ]);
      const branchData = Array.isArray(branchRows) ? branchRows : [];
      setBranches(branchData);

      const salesRows = (salesResp?.data || []) as Array<{
        date: string;
        orders: number;
        net_sales: number;
      }>;
      const itemsRows = (itemsResp?.data || []) as Array<{
        item_name: string;
        qty: number;
        revenue: number;
      }>;
      const hourlyRows = (hourlyResp?.data || []) as Array<{ hour: string; invoices: number; sales: number }>;
      const invoiceRows = (invoiceResp?.data || []) as Array<{
        invoice_no: string;
        opened_at: string;
        order_type: string;
        status: string;
        total: number;
      }>;
      const cashierRows = (cashierResp?.data || []) as Array<{ user_id: string; orders: number; sales: number }>;
      const paymentRows = (paymentResp?.data || []) as Array<{ method: string; count: number; amount: number }>;

      const today = new Date().toISOString().slice(0, 10);
      const todayRows = salesRows.filter((r) => r.date === today);
      const salesToday = todayRows.reduce((s, r) => s + Number(r.net_sales || 0), 0);
      const ordersCount = todayRows.reduce((s, r) => s + Number(r.orders || 0), 0);
      const avgOrderValue = ordersCount > 0 ? salesToday / ordersCount : 0;

      setStats({
        salesToday,
        ordersCount,
        avgOrderValue,
        topItemsCount: itemsRows.length
      });

      if (liveResp && typeof liveResp === "object") {
        setLiveOps({
          active_orders: Number((liveResp as { active_orders?: number }).active_orders ?? 0),
          kds_tickets: Number((liveResp as { kds_tickets?: number }).kds_tickets ?? 0),
          occupied_tables: Number((liveResp as { occupied_tables?: number }).occupied_tables ?? 0)
        });
      }

      const groupedByDate = new Map<string, number>();
      for (const row of salesRows) {
        groupedByDate.set(row.date, (groupedByDate.get(row.date) || 0) + Number(row.net_sales || 0));
      }
      const line = [...groupedByDate.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date: date.slice(5), value }))
        .slice(-12);
      setSalesSeries(line);

      const category = itemsRows
        .slice(0, 5)
        .map((r) => ({ name: r.item_name, value: Number(r.revenue || 0) }));
      setCategorySeries(category);
      setTopItems(itemsRows.slice(0, 8));
      setCashierSeries(
        cashierRows
          .sort((a, b) => Number(b.sales || 0) - Number(a.sales || 0))
          .slice(0, 8)
          .map((r) => ({
            user: r.user_id === "unknown" ? "Unknown" : String(r.user_id).slice(0, 8),
            orders: Number(r.orders || 0),
            sales: Number(r.sales || 0)
          }))
      );
      setPaymentMethodSeries(
        paymentRows.map((r) => ({
          method: String(r.method || "unknown").toUpperCase(),
          count: Number(r.count || 0),
          amount: Number(r.amount || 0)
        }))
      );
      setInvoiceSeries(
        invoiceRows.map((r) => ({
          invoice_no: r.invoice_no || "-",
          opened_at: String(r.opened_at || ""),
          order_type: r.order_type || "-",
          status: r.status || "-",
          total: Number(r.total || 0)
        }))
      );

      const timelineRows = line.map((r) => {
        const dayRows = salesRows.filter((x) => x.date.slice(5) === r.date);
        return {
          hour: r.date,
          orders: dayRows.reduce((sum, x) => sum + Number(x.orders || 0), 0),
          sales: Number(r.value || 0)
        };
      });
      setTimeline(timelineRows);
      setHourlySeries(
        hourlyRows.map((r) => ({
          hour: r.hour,
          invoices: Number(r.invoices || 0),
          sales: Number(r.sales || 0)
        }))
      );
    } catch (e) {
      if (!quiet) {
        const msg =
          e instanceof Error
            ? e.name === "AbortError"
              ? "Dashboard timed out — start the API on port 3000 or check NEXT_PUBLIC_API_URL."
              : e.message || "Could not load dashboard."
            : "Could not load dashboard.";
        notify(msg);
      }
      setSalesSeries([]);
      setCategorySeries([]);
      setHourlySeries([]);
      setTopItems([]);
      setTimeline([]);
      setCashierSeries([]);
      setPaymentMethodSeries([]);
      setInvoiceSeries([]);
      setStats({
        salesToday: 0,
        ordersCount: 0,
        avgOrderValue: 0,
        topItemsCount: 0
      });
      setLiveOps({
        active_orders: 0,
        kds_tickets: 0,
        occupied_tables: 0
      });
    } finally {
      setDataLoading(false);
    }
  },
  [notify]
  );

  const { connected: tenantLiveConnected } = useAdminTenantRealtime(() => {
    void loadDashboard(selectedBranch || undefined, { quiet: true });
  });

  useEffect(() => {
    const remembered = localStorage.getItem("pt_branch_id") || "";
    if (!selectedBranch && remembered) {
      setSelectedBranch(remembered);
      return;
    }
    void loadDashboard(selectedBranch || undefined);
  }, [selectedBranch, loadDashboard]);

  const chartProps = useMemo(
    () => ({
      salesSeries,
      categorySeries,
      hourlySeries,
      cashierSeries,
      paymentMethodSeries,
      topItems,
      timeline,
      invoiceSeries
    }),
    [salesSeries, categorySeries, hourlySeries, cashierSeries, paymentMethodSeries, topItems, timeline, invoiceSeries]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Modern Analytics Dashboard"
        description="Real-time sales and operations intelligence"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                tenantLiveConnected
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-zinc-300 bg-zinc-100 text-zinc-600 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              )}
              title="Subscribed to admin.tenant — updates when orders, payments, tables, or KDS change"
            >
              <Radio
                className={cn("h-3.5 w-3.5", tenantLiveConnected && "fill-emerald-500 text-emerald-500")}
                strokeWidth={2.5}
              />
              {tenantLiveConnected ? "Tenant live" : "Realtime off"}
            </span>
            <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="min-w-40">
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              className="bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={() => {
                void loadDashboard(selectedBranch || undefined);
                notify("Dashboard refreshed");
              }}
            >
              Refresh
            </button>
          </div>
        }
      />

      {!dataLoading && (
        <div className="grid gap-3 sm:grid-cols-3">
          <LiveOpsPill
            label="Active orders"
            value={liveOps.active_orders}
            hint="Open / in-progress checks (scoped branch)"
          />
          <LiveOpsPill
            label="KDS tickets"
            value={liveOps.kds_tickets}
            hint="Kitchen queue: new, preparing, ready"
          />
          <LiveOpsPill
            label="Occupied tables"
            value={liveOps.occupied_tables}
            hint="Open table sessions"
          />
        </div>
      )}

      {dataLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
          <LoadingSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Sales Today" value={stats.salesToday} prefix="$" />
          <MetricCard label="Orders Count" value={stats.ordersCount} />
          <MetricCard label="Average Order Value" value={stats.avgOrderValue} prefix="$" />
          <MetricCard label="Top Items" value={stats.topItemsCount} />
        </div>
      )}

      {!dataLoading && <DashboardCharts {...chartProps} />}
    </div>
  );
}

function LiveOpsPill({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="card flex items-center justify-between gap-3 p-4" title={hint}>
      <div>
        <p className="muted text-xs font-medium uppercase tracking-wide">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      </div>
      <div className="h-10 w-1 rounded-full bg-indigo-500/30" aria-hidden />
    </div>
  );
}

function MetricCard({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => latest.toFixed(0));
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.8 });
    const unsub = rounded.on("change", (latest) => setDisplay(latest));
    return () => {
      controls.stop();
      unsub();
    };
  }, [value, count, rounded]);

  return (
    <motion.div whileHover={{ y: -2 }} className="card soft-hover p-4">
      <p className="muted text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {prefix}
        {display}
      </p>
    </motion.div>
  );
}
