"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/settings/settings-tabs";
import { PermissionMatrix } from "@/components/settings/permission-matrix";
import { TaxEditor, TaxRule } from "@/components/settings/tax-editor";
import { PaymentMethodList } from "@/components/settings/payment-method-list";
import { DeviceManager } from "@/components/settings/device-manager";
import { apiGet, apiPost, apiPut } from "@/lib/api";
import { useToast } from "@/components/toast";

type SaveState = "idle" | "saving" | "saved";

const tabs = [
  { id: "company", label: "Company" },
  { id: "concept", label: "Concept" },
  { id: "branch", label: "Branch" },
  { id: "tax", label: "Taxes" },
  { id: "service", label: "Service Charge" },
  { id: "payment", label: "Payment Methods" },
  { id: "roles", label: "Roles & Permissions" },
  { id: "devices", label: "Devices" },
  { id: "integrations", label: "Integrations" }
];

const permissions = [
  { key: "orders.read", label: "View orders" },
  { key: "orders.manage", label: "Manage orders" },
  { key: "inventory.manage", label: "Manage inventory" },
  { key: "reports.read", label: "View reports" },
  { key: "settings.manage", label: "Manage settings" }
];

export default function SettingsPage() {
  const { notify } = useToast();
  const [tab, setTab] = useState("company");
  const [save, setSave] = useState<SaveState>("idle");

  const [company, setCompany] = useState({ name: "", email: "", phone: "", timezone: "UTC" });
  const [concepts, setConcepts] = useState<Array<{ id: string; name: string }>>([]);
  const [branches, setBranches] = useState<Array<{ id: string; name: string; timezone?: string; currency?: string }>>([]);
  const [selectedConcept, setSelectedConcept] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("");
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [serviceCharges, setServiceCharges] = useState<TaxRule[]>([]);
  const [paymentMethods, setPaymentMethods] = useState([
    { id: "pm-cash", name: "Cash", enabled: true },
    { id: "pm-card", name: "Card", enabled: true }
  ]);
  const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({});
  const [devices, setDevices] = useState<Array<{ id: string; name: string; code: string; status: string }>>([]);
  const [apiKey, setApiKey] = useState("sk_live_xxxxxxxxxxxxxxxxx");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("whsec_xxxxxxxxxxxxx");

  useEffect(() => {
    void (async () => {
      try {
        const [tenant, cRows, bRows, rolePermissionRows, deviceRows] = await Promise.all([
          apiGet("/tenant/me"),
          apiGet("/concepts"),
          apiGet("/branches"),
          apiGet("/roles/permissions"),
          apiGet("/devices")
        ]);
        setCompany({
          name: tenant?.name || "",
          email: tenant?.email || "ops@company.local",
          phone: tenant?.phone || "+0000000000",
          timezone: tenant?.timezone || "UTC"
        });
        const c = Array.isArray(cRows) ? cRows : [];
        const b = Array.isArray(bRows) ? bRows : [];
        setConcepts(c);
        setBranches(b);
        setSelectedConcept(c[0]?.id || "");
        setSelectedBranch(b[0]?.id || "");
        const roleRows = Array.isArray(rolePermissionRows) ? rolePermissionRows : [];
        const mappedRoles = roleRows.map((r: any) => ({ id: r.id, name: r.name }));
        setRoles(mappedRoles);
        const seedMatrix: Record<string, Record<string, boolean>> = {};
        roleRows.forEach((r: any) => {
          const enabled = new Set<string>(Array.isArray(r.permissions) ? r.permissions : []);
          seedMatrix[r.id] = Object.fromEntries(permissions.map((p) => [p.key, enabled.has(p.key)]));
        });
        setMatrix(seedMatrix);
        setDevices(
          (Array.isArray(deviceRows) ? deviceRows : []).map((d: any) => ({
            id: d.id,
            name: d.deviceName || "POS Device",
            code: d.deviceCode,
            status: d.status
          }))
        );
        setTaxRules([
          { id: crypto.randomUUID(), name: "VAT", rate: 15, enabled: true },
          { id: crypto.randomUUID(), name: "City Tax", rate: 2.5, enabled: false }
        ]);
        setServiceCharges([{ id: crypto.randomUUID(), name: "Service Charge", rate: 10, enabled: true }]);
      } catch (e) {
        notify(e instanceof Error ? e.message : "Failed to load settings");
      }
    })();
  }, []);

  const saveNow = async () => {
    setSave("saving");
    await new Promise((r) => setTimeout(r, 350));
    setSave("saved");
    setTimeout(() => setSave("idle"), 1200);
    notify("Settings saved");
  };

  const saveLabel = useMemo(() => {
    if (save === "saving") return "Saving...";
    if (save === "saved") return "Saved";
    return "Save changes";
  }, [save]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="System configuration for tenant, concepts, branches, taxes, permissions, devices, and integrations."
        action={
          <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white disabled:opacity-60" disabled={save === "saving"} onClick={() => void saveNow()}>
            {saveLabel}
          </button>
        }
      />
      <SettingsTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === "company" ? (
        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold">Company settings</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <input value={company.name} onChange={(e) => setCompany({ ...company, name: e.target.value })} placeholder="Company name" />
            <input value={company.email} onChange={(e) => setCompany({ ...company, email: e.target.value })} placeholder="Company email" />
            <input value={company.phone} onChange={(e) => setCompany({ ...company, phone: e.target.value })} placeholder="Phone" />
            <input value={company.timezone} onChange={(e) => setCompany({ ...company, timezone: e.target.value })} placeholder="Timezone" />
          </div>
        </div>
      ) : null}

      {tab === "concept" ? (
        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold">Concept settings</h3>
          <select value={selectedConcept} onChange={(e) => setSelectedConcept(e.target.value)}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="muted text-xs">Inline editing ready. Persist endpoint can be plugged in when concept update API is available.</p>
        </div>
      ) : null}

      {tab === "branch" ? (
        <div className="card space-y-3 p-4">
          <h3 className="text-sm font-semibold">Branch settings</h3>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={branches.find((x) => x.id === selectedBranch)?.timezone || ""}
              onChange={(e) => setBranches((prev) => prev.map((x) => (x.id === selectedBranch ? { ...x, timezone: e.target.value } : x)))}
              placeholder="Timezone"
            />
            <input
              value={branches.find((x) => x.id === selectedBranch)?.currency || ""}
              onChange={(e) => setBranches((prev) => prev.map((x) => (x.id === selectedBranch ? { ...x, currency: e.target.value } : x)))}
              placeholder="Currency"
            />
          </div>
        </div>
      ) : null}

      {tab === "tax" ? <TaxEditor title="Tax rules" rows={taxRules} onChange={setTaxRules} /> : null}
      {tab === "service" ? <TaxEditor title="Service charge rules" rows={serviceCharges} onChange={setServiceCharges} /> : null}
      {tab === "payment" ? <PaymentMethodList rows={paymentMethods} onChange={setPaymentMethods} /> : null}

      {tab === "roles" ? (
        <div className="space-y-3">
          <div className="card p-4">
            <h3 className="text-sm font-semibold">Manage roles</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {roles.map((r) => (
                <span key={r.id} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                  {r.name}
                </span>
              ))}
              <button
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800"
                onClick={() => {
                  const name = prompt("New role name");
                  if (!name) return;
                  const role = { id: crypto.randomUUID(), name };
                  setRoles((prev) => [...prev, role]);
                  setMatrix((prev) => ({ ...prev, [role.id]: Object.fromEntries(permissions.map((p) => [p.key, false])) }));
                }}
              >
                + Add role
              </button>
            </div>
          </div>
          <PermissionMatrix
            roles={roles}
            permissions={permissions}
            matrix={matrix}
            onToggle={(roleId, permissionKey) => {
              const current = Boolean(matrix[roleId]?.[permissionKey]);
              const nextRoleMatrix = { ...(matrix[roleId] || {}), [permissionKey]: !current };
              const next = { ...matrix, [roleId]: nextRoleMatrix };
              setMatrix(next);
              void (async () => {
                try {
                  const permissionKeys = Object.entries(nextRoleMatrix)
                    .filter(([, allowed]) => Boolean(allowed))
                    .map(([key]) => key);
                  await apiPut(`/roles/${roleId}/permissions`, { permission_keys: permissionKeys });
                  notify("Permissions updated");
                } catch (e) {
                  setMatrix(matrix);
                  notify(e instanceof Error ? e.message : "Failed to update permissions");
                }
              })();
            }}
          />
        </div>
      ) : null}

      {tab === "devices" ? (
        <DeviceManager
          rows={devices}
          onToggle={async (id) => {
            const row = devices.find((d) => d.id === id);
            if (!row) return;
            const endpoint = row.status === "active" ? `/devices/${id}/block` : `/devices/${id}/unblock`;
            await apiPost(endpoint, {});
            setDevices((prev) =>
              prev.map((x) => (x.id === id ? { ...x, status: x.status === "active" ? "blocked" : "active" } : x))
            );
            notify("Device status updated");
          }}
        />
      ) : null}

      {tab === "integrations" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card space-y-3 p-4">
            <h3 className="text-sm font-semibold">API keys</h3>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            <button
              className="rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
              onClick={() => setApiKey(`sk_live_${Math.random().toString(36).slice(2, 18)}`)}
            >
              Rotate key
            </button>
          </div>
          <div className="card space-y-3 p-4">
            <h3 className="text-sm font-semibold">Webhook config</h3>
            <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://example.com/webhook" />
            <input value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
            <label className="inline-flex items-center gap-2 text-xs">
              <input type="checkbox" defaultChecked />
              Enable webhook delivery
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
