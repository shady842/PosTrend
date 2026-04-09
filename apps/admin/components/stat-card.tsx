"use client";

import { motion } from "framer-motion";

type Props = {
  label: string;
  value: string;
  hint?: string;
};

export function StatCard({ label, value, hint }: Props) {
  return (
    <motion.div whileHover={{ y: -2 }} className="card soft-hover p-4">
      <p className="muted text-sm">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hint && <p className="muted mt-2 text-xs">{hint}</p>}
    </motion.div>
  );
}
