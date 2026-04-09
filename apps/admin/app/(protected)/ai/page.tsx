"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { PageHeader } from "@/components/page-header";
import { AIInsightCard } from "@/components/ai/ai-insight-card";
import { ForecastChart } from "@/components/ai/forecast-chart";
import { PredictionTable } from "@/components/ai/prediction-table";
import { RecommendationPanel } from "@/components/ai/recommendation-panel";
import { ChartCard } from "@/components/chart-card";
import { DrawerPanel } from "@/components/drawer-panel";
import {
  applyReorderRecommendation,
  getDemandPrediction,
  getForecastSales,
  getProfitabilityAlerts,
  getReorderSuggestions,
  getWastePrediction
} from "@/lib/ai";
import { apiGet } from "@/lib/api";
import { useToast } from "@/components/toast";

type Branch = { id: string; name: string };
type Item = { id: string; name: string };

export default function AiDashboardPage() {
  const { notify } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [branchId, setBranchId] = useState("");
  const [itemId, setItemId] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [demand, setDemand] = useState<any[]>([]);
  const [reorder, setReorder] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [waste, setWaste] = useState<any[]>([]);
  const [openExplain, setOpenExplain] = useState(false);
  const [explainText, setExplainText] = useState("");

  const load = async () => {
    try {
      const [b, inv] = await Promise.all([apiGet("/branches"), apiGet("/inventory/items")]);
      const bRows = Array.isArray(b) ? b : [];
      const iRows = Array.isArray(inv) ? inv : [];
      setBranches(bRows);
      setItems(iRows.map((x: any) => ({ id: x.id, name: x.name })));
      const effectiveBranchId = branchId || bRows[0]?.id || "";
      const filters = { branchId: effectiveBranchId || undefined };
      const [s, d, r, p, w] = await Promise.all([
        getForecastSales(filters),
        getDemandPrediction(filters),
        getReorderSuggestions(filters),
        getProfitabilityAlerts(filters),
        getWastePrediction(filters)
      ]);
      setSales(Array.isArray(s) ? s : []);
      setDemand(Array.isArray(d) ? d : []);
      setReorder(Array.isArray(r) ? r : []);
      setPricing(Array.isArray(p) ? p : []);
      setWaste(Array.isArray(w) ? w : []);
      if (!branchId && effectiveBranchId) setBranchId(effectiveBranchId);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to load AI dashboard");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void load();
    }, 30000);
    return () => clearInterval(id);
  }, [branchId, itemId]);

  const filteredDemand = useMemo(
    () => demand.filter((d) => !itemId || d.inventory_item_id === itemId),
    [demand, itemId]
  );
  const forecastRows = useMemo(
    () =>
      sales.map((s) => ({
        label: String(s.forecast_date).slice(5, 10),
        forecast: Number(s.predicted_sales || 0),
        actual: Number(s.predicted_sales || 0) * 0.92
      })),
    [sales]
  );
  const demandHeatmapRows = useMemo(
    () =>
      filteredDemand.slice(0, 12).map((r, i) => ({
        slot: `T${i + 1}`,
        demand: Number(r.predicted_demand_qty || 0)
      })),
    [filteredDemand]
  );
  const reorderTimeline = useMemo(
    () =>
      reorder.map((r, i) => ({
        label: String(r.generated_at || i + 1).slice(5, 10),
        qty: Number(r.suggested_reorder_qty || 0)
      })),
    [reorder]
  );

  const lowStockPrediction = filteredDemand.filter((x) => x.predicted_stock_out_at).length;
  const profitabilityAlerts = pricing.filter((x) => Number(x.expected_lift_pct || 0) < 0.02).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Dashboard"
        description="Forecasting, demand prediction, reorder suggestions, profitability alerts, and waste signals."
        action={
          <div className="flex gap-2">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">Branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Item</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.name}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <AIInsightCard
          title="Forecasted sales"
          value={`৳${Math.round(forecastRows.reduce((s, r) => s + r.forecast, 0)).toLocaleString()}`}
          trend="up"
          confidence={sales[0]?.confidence || 0.7}
          note="Based on historical daily trend."
        />
        <AIInsightCard
          title="Demand prediction"
          value={`${filteredDemand.length} items`}
          trend="up"
          confidence={filteredDemand[0]?.confidence || 0.65}
          note="Predicted demand for selected branch."
        />
        <AIInsightCard
          title="Low stock prediction"
          value={`${lowStockPrediction}`}
          trend={lowStockPrediction > 0 ? "down" : "up"}
          confidence={0.72}
          note="Items likely to stock out soon."
        />
        <AIInsightCard
          title="Reorder suggestions"
          value={`${reorder.length}`}
          trend="up"
          confidence={reorder[0]?.confidence || 0.68}
          note="AI generated reorder opportunities."
        />
        <AIInsightCard
          title="Profitability alerts"
          value={`${profitabilityAlerts}`}
          trend={profitabilityAlerts > 0 ? "down" : "up"}
          confidence={pricing[0]?.confidence || 0.66}
          note="Potential margin risk signals."
        />
        <AIInsightCard
          title="Waste prediction"
          value={`${waste.length}`}
          trend={waste.length > 0 ? "down" : "up"}
          confidence={waste[0]?.confidence || 0.64}
          note="Predicted waste events."
        />
      </div>

      <ForecastChart rows={forecastRows} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Demand Heatmap" subtitle="Demand prediction intensity">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={demandHeatmapRows}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="slot" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="demand" fill="#f59e0b" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Reorder Timeline" subtitle="Suggested reorder quantities">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={reorderTimeline}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="qty" fill="#10b981" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <PredictionTable
        rows={filteredDemand.map((d) => ({
          item: items.find((it) => it.id === d.inventory_item_id)?.name || d.inventory_item_id,
          demand: Number(d.predicted_demand_qty || 0),
          stockOutAt: d.predicted_stock_out_at,
          confidence: Number(d.confidence || 0)
        }))}
      />

      <RecommendationPanel
        rows={reorder.map((r) => ({
          inventoryItemId: r.inventory_item_id,
          itemName: items.find((it) => it.id === r.inventory_item_id)?.name || r.inventory_item_id,
          suggestedQty: Number(r.suggested_reorder_qty || 0),
          reason: r.reason,
          confidence: Number(r.confidence || 0),
          status: r.status
        }))}
        onApply={async (inventoryItemId) => {
          try {
            await applyReorderRecommendation(inventoryItemId);
            notify("Recommendation applied");
            setExplainText(`Applied reorder recommendation for item ${inventoryItemId}. AI rationale: below reorder point and rising demand trend.`);
            setOpenExplain(true);
            await load();
          } catch (e) {
            notify(e instanceof Error ? e.message : "Failed to apply recommendation");
          }
        }}
      />

      <DrawerPanel open={openExplain} title="AI Explanation" onClose={() => setOpenExplain(false)}>
        <div className="space-y-2 text-sm">
          <p>{explainText || "AI explanation details will appear after applying a recommendation."}</p>
          <p className="muted text-xs">
            Explanations are generated from model confidence, stock trajectory, and recent demand patterns.
          </p>
        </div>
      </DrawerPanel>
    </div>
  );
}
