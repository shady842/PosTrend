"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import { DrawerPanel } from "@/components/drawer-panel";
import { useToast } from "@/components/toast";
import { getAccessToken, getRefreshToken, setOwnerBackupTokens, setSessionTokens } from "@/lib/auth";

type TenantRow = {
  id: string;
  name: string;
  owner_email: string;
  slug: string;
  status: string;
  plan: string;
  plan_id?: string | null;
  trial_end?: string | null;
  branches_count: number;
  devices_count: number;
  users_count: number;
  created_at: string;
};

export default function SuperAdminTenantsPage() {
  const { notify } = useToast();
  const router = useRouter();
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [plans, setPlans] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active_or_trial");
  const [planFilter, setPlanFilter] = useState("all");
  const [trialExpiring, setTrialExpiring] = useState(false);
  const [selected, setSelected] = useState<TenantRow | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPlanId, setEditPlanId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editTrialEnd, setEditTrialEnd] = useState("");
  const [suspensionReason, setSuspensionReason] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([apiGet("/super-admin/tenants"), apiGet("/super-admin/plans")]);
      setRows(Array.isArray(r) ? r : []);
      setPlans(Array.isArray(p) ? p.map((x: any) => ({ id: x.id, name: x.name })) : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    return rows.filter((r) => {
      if (statusFilter === "active_or_trial") {
        if (r.status !== "active" && r.status !== "trial") return false;
      } else if (statusFilter !== "all" && r.status !== statusFilter) {
        return false;
      }
      if (planFilter !== "all" && (r.plan_id || "") !== planFilter) return false;
      if (trialExpiring) {
        const t = r.trial_end ? new Date(r.trial_end).getTime() : Number.NaN;
        if (!Number.isFinite(t) || t < now || t > week) return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.owner_email.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter, planFilter, trialExpiring]);

  const openDetails = async (row: TenantRow) => {
    setSelected(row);
    setEditName(row.name);
    setEditPlanId(row.plan_id || "");
    setEditStatus(row.status);
    setEditTrialEnd(row.trial_end ? new Date(row.trial_end).toISOString().slice(0, 10) : "");
    setSuspensionReason("");
    setDetailOpen(true);
    try {
      const d = await apiGet(`/super-admin/tenants/${row.id}`);
      setDetails(d);
    } catch {
      setDetails(null);
    }
  };

  const activateSuspend = async (row: TenantRow, action: "activate" | "suspend") => {
    await apiPost(
      `/super-admin/tenants/${row.id}/${action}`,
      action === "suspend" ? { reason: suspensionReason || "Suspended by super admin" } : {}
    );
    notify(`Tenant ${action}d`);
    await load();
    if (selected?.id === row.id) {
      const r = await apiGet("/super-admin/tenants");
      setRows(Array.isArray(r) ? r : []);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Tenants" description="Manage all platform tenants (global scope)." />
      <div className="card grid gap-2 p-3 md:grid-cols-5">
        <input placeholder="Search tenant / owner / slug" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="active_or_trial">Active + trial</option>
          <option value="all">All status</option>
          <option value="active">active</option>
          <option value="trial">trial</option>
          <option value="past_due">past_due</option>
          <option value="suspended">suspended</option>
          <option value="cancelled">cancelled</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="all">All plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={trialExpiring} onChange={(e) => setTrialExpiring(e.target.checked)} />
          Trial expiring (7d)
        </label>
        <button className="bg-slate-900 text-white dark:bg-indigo-600" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <div className="card overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-2">Tenant</th>
              <th className="py-2">Owner email</th>
              <th className="py-2">Plan</th>
              <th className="py-2">Status</th>
              <th className="py-2">Trial end</th>
              <th className="py-2">Branches</th>
              <th className="py-2">Devices</th>
              <th className="py-2">Created</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(loading ? [] : filtered).map((r) => (
              <tr key={r.id} className="border-t border-slate-200 dark:border-slate-800">
                <td className="py-2">
                  <div className="font-medium">{r.name}</div>
                  <div className="muted text-xs">{r.slug}</div>
                </td>
                <td className="py-2">{r.owner_email || "-"}</td>
                <td className="py-2">{r.plan}</td>
                <td className="py-2">{r.status}</td>
                <td className="py-2">{r.trial_end ? new Date(r.trial_end).toLocaleDateString() : "-"}</td>
                <td className="py-2">{r.branches_count}</td>
                <td className="py-2">{r.devices_count}</td>
                <td className="py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                <td className="py-2">
                  <div className="flex justify-end gap-1">
                    <button className="bg-slate-100 text-xs dark:bg-slate-800" onClick={() => void openDetails(r)}>
                      View
                    </button>
                    <button className="bg-slate-100 text-xs dark:bg-slate-800" onClick={() => void openDetails(r)}>
                      Edit
                    </button>
                    {r.status === "suspended" ? (
                      <button className="bg-emerald-600 text-xs text-white" onClick={() => void activateSuspend(r, "activate")}>
                        Activate
                      </button>
                    ) : (
                      <button className="bg-amber-600 text-xs text-white" onClick={() => void activateSuspend(r, "suspend")}>
                        Suspend
                      </button>
                    )}
                    <button
                      className="bg-slate-100 text-xs dark:bg-slate-800"
                      onClick={() => notify("Delete API not enabled in this phase")}
                    >
                      Delete
                    </button>
                    <button
                      className="bg-indigo-600 text-xs text-white"
                      onClick={async () => {
                        const currentAccess = getAccessToken();
                        const currentRefresh = getRefreshToken();
                        if (!currentAccess) {
                          notify("Missing owner session token");
                          return;
                        }
                        const res = await apiPost(`/super-admin/tenants/${r.id}/impersonate`, {});
                        setOwnerBackupTokens(currentAccess, currentRefresh || undefined);
                        setSessionTokens(res.access_token, res.refresh_token);
                        notify(`Now impersonating ${r.name}`);
                        router.push("/dashboard");
                      }}
                    >
                      Impersonate
                    </button>
                    <button
                      className="bg-rose-700 text-xs text-white"
                      onClick={async () => {
                        await apiPatch(`/super-admin/tenants/${r.id}`, { status: "cancelled" });
                        notify("Tenant cancelled");
                        await load();
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      className="bg-emerald-700 text-xs text-white"
                      onClick={async () => {
                        await apiPatch(`/super-admin/tenants/${r.id}`, { status: "active" });
                        notify("Tenant restored");
                        await load();
                      }}
                    >
                      Restore
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <DrawerPanel
        open={detailOpen}
        title={selected ? `Tenant: ${selected.name}` : "Tenant details"}
        onClose={() => {
          setDetailOpen(false);
          setDetails(null);
          setSelected(null);
        }}
        panelClassName="max-w-3xl"
      >
        {!selected ? null : (
          <div className="space-y-4">
            <section className="card space-y-2 p-3">
              <h3 className="text-sm font-semibold">General info</h3>
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs">Name</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                    <option value="active">active</option>
                    <option value="trial">trial</option>
                    <option value="past_due">past_due</option>
                    <option value="suspended">suspended</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs">Plan info</label>
                  <select value={editPlanId} onChange={(e) => setEditPlanId(e.target.value)}>
                    <option value="">No plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs">Trial end</label>
                  <input type="date" value={editTrialEnd} onChange={(e) => setEditTrialEnd(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs">Suspension reason</label>
                  <input value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)} />
                </div>
              </div>
              <button
                className="bg-indigo-600 text-white"
                onClick={async () => {
                  await apiPatch(`/super-admin/tenants/${selected.id}`, {
                    name: editName,
                    status: editStatus,
                    plan_id: editPlanId || undefined,
                    trial_ends_at: editTrialEnd ? new Date(editTrialEnd).toISOString() : undefined,
                    suspension_reason: suspensionReason || undefined
                  });
                  notify("Tenant updated");
                  await load();
                  const d = await apiGet(`/super-admin/tenants/${selected.id}`);
                  setDetails(d);
                }}
              >
                Save tenant
              </button>
            </section>

            <section className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">Usage</h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>Branches: {details?.usage?.branches_count ?? "-"}</div>
                <div>Devices: {details?.usage?.devices_count ?? "-"}</div>
                <div>Users: {details?.usage?.users_count ?? "-"}</div>
              </div>
            </section>

            <section className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">Branches</h3>
              <div className="space-y-1 text-sm">
                {(details?.branches || []).map((b: any) => (
                  <div key={b.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span>{b.name}</span>
                    <span className="muted">{b.devices_count} devices</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">Devices</h3>
              <div className="space-y-1 text-sm">
                {(details?.devices || []).slice(0, 10).map((d: any) => (
                  <div key={d.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span>{d.code}</span>
                    <span className="muted">{d.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">Users</h3>
              <div className="space-y-1 text-sm">
                {(details?.users || []).slice(0, 12).map((u: any) => (
                  <div key={u.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span>{u.full_name || u.email}</span>
                    <span className="muted">{u.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">Subscription history</h3>
              <div className="space-y-1 text-sm">
                {(details?.subscription_history || []).map((s: any) => (
                  <div key={s.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span>{s.plan_name || s.plan_id}</span>
                    <span className="muted">{s.status}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-3">
              <h3 className="mb-2 text-sm font-semibold">Audit log</h3>
              <div className="space-y-1 text-sm">
                {(details?.audit_log || []).map((a: any) => (
                  <div key={a.id} className="flex justify-between border-b border-slate-100 py-1 dark:border-slate-800">
                    <span>{a.action}</span>
                    <span className="muted">{new Date(a.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </DrawerPanel>
    </div>
  );
}

