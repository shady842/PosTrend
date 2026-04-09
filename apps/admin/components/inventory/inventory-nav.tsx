"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/inventory", label: "Overview", exact: true },
  { href: "/inventory/items", label: "Items" },
  { href: "/inventory/item-master", label: "Item master" },
  { href: "/inventory/stock", label: "Stock" },
  { href: "/inventory/stock-counts", label: "Stock counts" },
  { href: "/inventory/purchase-orders", label: "Purchase orders" },
  { href: "/inventory/reorder", label: "Reorder" },
  { href: "/inventory/production", label: "Production" },
  { href: "/inventory/suppliers", label: "Suppliers" },
  { href: "/inventory/transfers", label: "Transfers" },
  { href: "/inventory/wastage", label: "Wastage" }
];

export function InventoryNav() {
  const pathname = usePathname();
  return (
    <nav className="mb-6 flex flex-wrap gap-1 rounded-2xl border border-slate-200/80 bg-white/60 p-1 dark:border-slate-700/80 dark:bg-slate-900/40">
      {links.map((l) => {
        const on = l.exact
          ? pathname === l.href
          : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "rounded-xl px-3 py-2 text-sm font-medium transition",
              on ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
