"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearAccessToken,
  clearOwnerBackupTokens,
  decodeJwtPayload,
  getAccessToken,
  getOwnerBackupTokens,
  setSessionTokens
} from "@/lib/auth";
import { apiGet } from "@/lib/api";
import { Sidebar } from "@/components/sidebar";
import { TopNavbar } from "@/components/top-navbar";
import { ToastProvider } from "@/components/toast";

type Props = { children: ReactNode };
type Option = { id: string; name: string };

const crumbsMap: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/live-pos": "Live POS",
  "/table-layout": "Table Layout",
  "/menu": "Menu",
  "/inventory": "Inventory",
  "/ai": "AI Dashboard",
  "/reports": "Reports",
  "/accounting": "Accounting",
  "/hr": "HR & Payroll",
  "/concepts": "Concepts",
  "/branches": "Branches",
  "/devices": "Devices",
  "/users": "Users",
  "/settings": "Settings"
};

export function AppLayout({ children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantName, setTenantName] = useState("Tenant");
  const [concepts, setConcepts] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [conceptId, setConceptId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  const [impersonatingTenantId, setImpersonatingTenantId] = useState<string>("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("pt_theme");
    const isDark = savedTheme === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    setConceptId(localStorage.getItem("pt_concept_id") || "");
    setBranchId(localStorage.getItem("pt_branch_id") || "");
    setCollapsed(localStorage.getItem("pt_sidebar") === "1");
    const token = getAccessToken();
    const payload = token ? decodeJwtPayload<Record<string, any>>(token) : null;
    setImpersonatingTenantId(payload?.impersonating_tenant ? String(payload?.tenant_id || "") : "");
    void (async () => {
      try {
        const [tenant, cRows, bRows] = await Promise.all([apiGet("/tenant/me"), apiGet("/concepts"), apiGet("/branches")]);
        setTenantName(tenant?.name || "Tenant");
        setConcepts(cRows || []);
        setBranches(bRows || []);
      } catch {
        // middleware handles auth redirects
      }
    })();
  }, []);

  const breadcrumb = useMemo(() => {
    if (crumbsMap[pathname]) return crumbsMap[pathname];
    if (pathname.startsWith("/inventory")) return "Inventory";
    if (pathname.startsWith("/table-layout")) return "Table Layout";
    if (pathname.startsWith("/ai")) return "AI Dashboard";
    if (pathname.startsWith("/reports")) return "Reports";
    if (pathname.startsWith("/hr")) return "HR & Payroll";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Page";
  }, [pathname]);

  const onLogout = () => {
    clearAccessToken();
    router.push("/login");
  };

  const onToggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("pt_theme", next ? "dark" : "light");
  };

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <Sidebar
          pathname={pathname}
          collapsed={collapsed}
          onToggle={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.setItem("pt_sidebar", next ? "1" : "0");
          }}
        />
        <main className="flex-1">
          <TopNavbar
            tenantName={tenantName}
            conceptId={conceptId}
            branchId={branchId}
            concepts={concepts}
            branches={branches}
            onConceptChange={(v) => {
              setConceptId(v);
              localStorage.setItem("pt_concept_id", v);
            }}
            onBranchChange={(v) => {
              setBranchId(v);
              localStorage.setItem("pt_branch_id", v);
            }}
            onToggleTheme={onToggleTheme}
            dark={dark}
            onLogout={onLogout}
          />
          {impersonatingTenantId ? (
            <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
              <span>You are impersonating tenant `{impersonatingTenantId}`</span>
              <button
                className="bg-amber-600 text-white hover:bg-amber-500"
                onClick={() => {
                  const backup = getOwnerBackupTokens();
                  if (backup.access) {
                    setSessionTokens(backup.access, backup.refresh || undefined);
                    clearOwnerBackupTokens();
                    router.push("/super-admin/dashboard");
                    return;
                  }
                  clearAccessToken();
                  clearOwnerBackupTokens();
                  router.push("/super-admin/login");
                }}
              >
                Exit impersonation
              </button>
            </div>
          ) : null}
          <div className="px-4 py-3 text-sm muted">Home / {breadcrumb}</div>
          <section className="px-4 pb-6 md:px-6">{children}</section>
        </main>
      </div>
    </ToastProvider>
  );
}
