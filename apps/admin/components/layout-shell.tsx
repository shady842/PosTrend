"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { clearAccessToken } from "@/lib/auth";
import { apiGet } from "@/lib/api";

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/concepts", label: "Concepts" },
  { href: "/branches", label: "Branches" },
  { href: "/devices", label: "Devices" },
  { href: "/users", label: "Users" }
];

type Props = { children: ReactNode };

type Concept = { id: string; name: string };
type Branch = { id: string; name: string };

export function LayoutShell({ children }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [tenantName, setTenantName] = useState("Tenant");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [conceptId, setConceptId] = useState("");
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    const c = localStorage.getItem("pt_concept_id") || "";
    const b = localStorage.getItem("pt_branch_id") || "";
    setConceptId(c);
    setBranchId(b);
    void (async () => {
      try {
        const [tenant, conceptRows, branchRows] = await Promise.all([
          apiGet("/tenant/me"),
          apiGet("/concepts"),
          apiGet("/branches")
        ]);
        setTenantName(tenant?.name || "Tenant");
        setConcepts(conceptRows || []);
        setBranches(branchRows || []);
        if (!c && conceptRows?.length) {
          const first = conceptRows[0].id;
          setConceptId(first);
          localStorage.setItem("pt_concept_id", first);
        }
        if (!b && branchRows?.length) {
          const first = branchRows[0].id;
          setBranchId(first);
          localStorage.setItem("pt_branch_id", first);
        }
      } catch {
        // auth middleware will route unauthenticated users
      }
    })();
  }, []);

  const logout = () => {
    clearAccessToken();
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-slate-200 bg-white p-4">
        <h1 className="mb-6 text-xl font-bold text-brand-600">PosTrend Admin</h1>
        <nav className="space-y-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-md px-3 py-2 text-sm ${
                path.startsWith(item.href) ? "bg-brand-500 text-white" : "hover:bg-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <p className="text-xs text-slate-500">Tenant</p>
            <p className="font-semibold">{tenantName}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={conceptId}
              onChange={(e) => {
                setConceptId(e.target.value);
                localStorage.setItem("pt_concept_id", e.target.value);
              }}
            >
              <option value="">Select concept</option>
              {concepts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={branchId}
              onChange={(e) => {
                setBranchId(e.target.value);
                localStorage.setItem("pt_branch_id", e.target.value);
              }}
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button onClick={logout} className="bg-slate-900 text-white hover:bg-black">
              Logout
            </button>
          </div>
        </header>
        <section className="p-6">{children}</section>
      </main>
    </div>
  );
}
