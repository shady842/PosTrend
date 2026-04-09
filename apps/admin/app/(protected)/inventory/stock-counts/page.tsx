"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { DataTable } from "@/components/data-table";

type Session = { id: string; name: string; status: "draft" | "in_progress" | "reconciled"; createdAt: string; lines: number };

export default function StockCountSessionsPage() {
  const [rows, setRows] = useState<Session[]>([]);

  const openCount = () => {
    setRows((prev) => [
      {
        id: crypto.randomUUID(),
        name: `Cycle Count ${new Date().toISOString().slice(0, 10)}`,
        status: "draft",
        createdAt: new Date().toISOString(),
        lines: 0
      },
      ...prev
    ]);
  };

  const stats = useMemo(
    () => ({
      open: rows.filter((r) => r.status !== "reconciled").length,
      reconciled: rows.filter((r) => r.status === "reconciled").length
    }),
    [rows]
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Counts"
        description={`Count sessions: ${stats.open} open, ${stats.reconciled} reconciled`}
        action={
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white" onClick={openCount}>
            New count session
          </button>
        }
      />
      <DataTable
        data={rows}
        columns={[
          { key: "name", header: "Session", render: (r) => r.name },
          { key: "status", header: "Status", render: (r) => r.status },
          { key: "lines", header: "Lines", render: (r) => String(r.lines) },
          { key: "date", header: "Created", render: (r) => String(r.createdAt).slice(0, 10) }
        ]}
      />
    </div>
  );
}
