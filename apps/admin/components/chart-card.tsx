"use client";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  contentClassName?: string;
};

export function ChartCard({ title, subtitle, children, contentClassName }: Props) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle ? <p className="muted mb-2 mt-1 text-xs">{subtitle}</p> : null}
      <div className={cn(subtitle ? "" : "mt-2", "h-48", contentClassName)}>{children}</div>
    </div>
  );
}
