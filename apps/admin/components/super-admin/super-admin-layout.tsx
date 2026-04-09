"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CreditCard,
  LayoutDashboard,
  Logs,
  Moon,
  Search,
  Settings,
  Sun,
  UserCircle2,
  Users,
  Wallet
} from "lucide-react";
import { PortalLinks } from "@/components/portal-links";
import { apiGet } from "@/lib/api";
import { clearAccessToken } from "@/lib/auth";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/super-admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/super-admin/tenants", label: "Tenants", icon: Building2 },
  { href: "/super-admin/plans", label: "Plans", icon: Wallet },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/super-admin/billing", label: "Billing", icon: CreditCard },
  { href: "/super-admin/usage", label: "Usage", icon: BarChart3 },
  { href: "/super-admin/blog", label: "Blog", icon: BookOpen },
  { href: "/super-admin/logs", label: "Logs", icon: Logs },
  { href: "/super-admin/settings", label: "Settings", icon: Settings }
];

type Me = { fullName?: string; email?: string };

export function SuperAdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [me, setMe] = useState<Me>({});
  const [status, setStatus] = useState<"ok" | "degraded">("ok");

  useEffect(() => {
    const saved = localStorage.getItem("pt_theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    setCollapsed(localStorage.getItem("pt_super_sidebar") === "1");
    void (async () => {
      try {
        const info = await apiGet("/super-admin/me");
        setMe(info || {});
        const h = await apiGet("/health");
        setStatus(h?.status === "ok" ? "ok" : "degraded");
      } catch {
        setStatus("degraded");
      }
    })();
  }, []);

  const onLogout = () => {
    clearAccessToken();
    router.push("/super-admin/login");
  };

  const crumb = useMemo(() => {
    const hit = nav.find((n) => pathname.startsWith(n.href));
    return hit?.label || "Owner Panel";
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      <aside className={cn("glass hidden border-r p-4 md:block", collapsed ? "w-[90px]" : "w-[260px]")}>
        <div className="mb-4 text-sm font-semibold">{collapsed ? "SA" : "PosTrend Owner"}</div>
        <nav className="space-y-2">
          {nav.map((n) => {
            const Icon = n.icon;
            const active = pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2 text-sm",
                  active ? "bg-indigo-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
                )}
              >
                <Icon className="h-4 w-4" />
                {!collapsed && <span>{n.label}</span>}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-white/80 px-4 py-3 backdrop-blur dark:bg-slate-950/80">
          <button
            type="button"
            className="bg-slate-100 text-xs dark:bg-slate-800"
            onClick={() => {
              const v = !collapsed;
              setCollapsed(v);
              localStorage.setItem("pt_super_sidebar", v ? "1" : "0");
            }}
          >
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
            <input className="w-full pl-8" placeholder="Global search..." />
          </div>
          <div className="hidden shrink-0 items-center border-l border-slate-200 pl-3 dark:border-slate-700 lg:flex">
            <PortalLinks tone="marketing" />
          </div>
          <span className={cn("rounded-full px-2 py-1 text-xs", status === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
            System {status}
          </span>
          <button type="button" className="bg-slate-100 dark:bg-slate-800">
            <Bell className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="bg-slate-100 dark:bg-slate-800"
            onClick={() => {
              const next = !dark;
              setDark(next);
              document.documentElement.classList.toggle("dark", next);
              localStorage.setItem("pt_theme", next ? "dark" : "light");
            }}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 rounded-xl border px-2 py-1 text-xs">
            <UserCircle2 className="h-4 w-4" />
            <span>{me.fullName || me.email || "Owner"}</span>
          </div>
          <button type="button" className="bg-slate-900 text-white dark:bg-indigo-600" onClick={onLogout}>
            Logout
          </button>
        </div>
        <div className="px-4 py-2 text-sm muted">Owner / {crumb}</div>
        <section className="px-4 pb-6">{children}</section>
      </main>
    </div>
  );
}

