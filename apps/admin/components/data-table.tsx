"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
};

type Props<T> = {
  data: T[];
  columns: Column<T>[];
};

export function DataTable<T>({ data, columns }: Props<T>) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200/70 dark:border-slate-700/70">
            {columns.map((col) => (
              <th key={col.key} className="p-3 text-left font-medium muted">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <motion.tr
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="border-b border-slate-100 dark:border-slate-800/80 last:border-0"
            >
              {columns.map((col) => (
                <td key={col.key} className="p-3">
                  {col.render(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
