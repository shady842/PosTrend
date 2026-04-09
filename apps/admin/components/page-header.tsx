"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-5 flex items-center justify-between"
    >
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="muted mt-1 text-sm">{description}</p>}
      </div>
      {action}
    </motion.div>
  );
}
