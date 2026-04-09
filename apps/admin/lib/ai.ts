"use client";

import { apiGet, apiPost } from "@/lib/api";

export type AiFilters = {
  branchId?: string;
  itemId?: string;
  dateFrom?: string;
  dateTo?: string;
  horizon?: "daily" | "intraday";
};

function query(filters: AiFilters) {
  const params = new URLSearchParams();
  if (filters.branchId) params.set("branch_id", filters.branchId);
  if (filters.itemId) params.set("item_id", filters.itemId);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.horizon) params.set("horizon", filters.horizon);
  return params.toString();
}

export async function getForecastSales(filters: AiFilters) {
  return apiGet(`/ai/forecast/sales?${query(filters)}`);
}
export async function getDemandPrediction(filters: AiFilters) {
  return apiGet(`/ai/forecast/inventory?${query(filters)}`);
}
export async function getReorderSuggestions(filters: AiFilters) {
  return apiGet(`/ai/reorder?${query(filters)}`);
}
export async function getWastePrediction(filters: AiFilters) {
  return apiGet(`/ai/waste?${query(filters)}`);
}
export async function getProfitabilityAlerts(filters: AiFilters) {
  return apiGet(`/ai/dynamic-pricing?${query(filters)}`);
}
export async function applyReorderRecommendation(inventoryItemId: string) {
  return apiPost("/ai/reorder/apply", { inventory_item_id: inventoryItemId });
}
