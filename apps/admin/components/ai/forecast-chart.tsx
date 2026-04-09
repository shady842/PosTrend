"use client";

import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";
import { ChartCard } from "@/components/chart-card";

type Props = {
  rows: Array<{ label: string; forecast: number; actual: number }>;
};

export function ForecastChart({ rows }: Props) {
  return (
    <ChartCard title="Forecast vs Actual" subtitle="Sales forecasting trend" contentClassName="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="forecast" stroke="#6366f1" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="actual" stroke="#0ea5e9" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
