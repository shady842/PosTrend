"use client";

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#0ea5e9", "#ef4444"];

export default function MiniCharts({ kind }: { kind: "revenue" | "expense" | "pnl" }) {
  if (kind === "expense") {
    const data = [
      { name: "Payroll", value: 35 },
      { name: "COGS", value: 28 },
      { name: "Rent", value: 18 },
      { name: "Utilities", value: 9 },
      { name: "Other", value: 10 }
    ];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" outerRadius={72} innerRadius={42} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  const data =
    kind === "revenue"
      ? [
          { m: "Jan", v: 82 },
          { m: "Feb", v: 95 },
          { m: "Mar", v: 90 },
          { m: "Apr", v: 108 },
          { m: "May", v: 126 },
          { m: "Jun", v: 120 }
        ]
      : [
          { m: "Jan", v: 12 },
          { m: "Feb", v: 18 },
          { m: "Mar", v: 10 },
          { m: "Apr", v: 22 },
          { m: "May", v: 30 },
          { m: "Jun", v: 24 }
        ];

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ left: 6, right: 6 }}>
        <XAxis dataKey="m" tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip />
        <Area type="monotone" dataKey="v" stroke="#6366f1" fill="#6366f1" fillOpacity={0.18} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

