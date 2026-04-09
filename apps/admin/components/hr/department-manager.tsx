"use client";

import { useState } from "react";
import { HrDepartment } from "@/lib/hr-api";

type Props = {
  departments: HrDepartment[];
  onAdd: (name: string, description?: string) => void;
};

export function DepartmentManager({ departments, onAdd }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">Department Manager</h3>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <input placeholder="Department name" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <button
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
          onClick={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            onAdd(trimmed, description.trim() || undefined);
            setName("");
            setDescription("");
          }}
        >
          Add Department
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
              <th className="py-2">Department</th>
              <th className="py-2">Description</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-3">{d.name}</td>
                <td className="py-3">{d.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
