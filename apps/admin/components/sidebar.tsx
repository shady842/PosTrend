"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  Building2,
  GitBranch,
  MonitorCog,
  Calculator,
  Radio,
  Users,
  PanelLeftClose,
  PanelLeft,
  UtensilsCrossed,
  Package,
  UsersRound,
  BarChart3,
  Sparkles,
  Settings,
  Grid3X3
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live-pos", label: "Live POS", icon: Radio },
  { href: "/table-layout", label: "Table Layout", icon: Grid3X3 },
  { href: "/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/ai", label: "AI Dashboard", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/accounting", label: "Accounting", icon: Calculator },
  { href: "/hr", label: "HR & Payroll", icon: UsersRound },
  { href: "/concepts", label: "Concepts", icon: Building2 },
  { href: "/branches", label: "Branches", icon: GitBranch },
  { href: "/devices", label: "Devices", icon: MonitorCog },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings }
];

type Props = {
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
};

export function Sidebar({ pathname, collapsed, onToggle }: Props) {
  return (
    <aside
      className={cn(
        "glass hidden border-r p-4 md:block",
        collapsed ? "w-[84px]" : "w-[260px]",
        "border-slate-200/60 dark:border-slate-700/50"
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        {!collapsed && <h1 className="text-lg font-semibold">PosTrend Admin</h1>}
        <button className="bg-slate-100 dark:bg-slate-800" onClick={onToggle}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
      <nav className="space-y-2">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/60"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
