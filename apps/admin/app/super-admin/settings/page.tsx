"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPatch } from "@/lib/api";

type SettingsForm = {
  system_name: string;
  support_email: string;
  maintenance_mode: string;
  default_trial_days: number;
  default_plan_id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_password: string;
  smtp_from_email: string;
  smtp_from_name: string;
  storage_driver: string;
  storage_bucket: string;
  storage_region: string;
  storage_base_url: string;
  branding_app_name: string;
  branding_logo_url: string;
  feature_inventory: boolean;
  feature_billing: boolean;
  feature_reports: boolean;
  feature_hr: boolean;
  feature_promotions: boolean;
  global_tax_default: number;
  currency_default: string;
  timezone_default: string;
};

type PlanOption = {
  id: string;
  name: string;
  code: string;
};

const TABS = [
  { id: "general", label: "General" },
  { id: "email", label: "Email / SMTP" },
  { id: "storage", label: "Storage" },
  { id: "branding", label: "Branding" },
  { id: "features", label: "Feature Flags" }
] as const;

export default function SuperAdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("general");
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [form, setForm] = useState<SettingsForm>({
    system_name: "",
    support_email: "",
    maintenance_mode: "off",
    default_trial_days: 14,
    default_plan_id: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_user: "",
    smtp_password: "",
    smtp_from_email: "",
    smtp_from_name: "",
    storage_driver: "local",
    storage_bucket: "",
    storage_region: "",
    storage_base_url: "",
    branding_app_name: "PosTrend",
    branding_logo_url: "",
    feature_inventory: true,
    feature_billing: true,
    feature_reports: true,
    feature_hr: true,
    feature_promotions: true,
    global_tax_default: 0,
    currency_default: "USD",
    timezone_default: "UTC"
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [settings, plansData] = await Promise.all([
        apiGet("/super-admin/settings"),
        apiGet("/super-admin/plans")
      ]);
      setPlans(
        Array.isArray(plansData)
          ? plansData.map((p: any) => ({ id: p.id, name: p.name, code: p.code }))
          : []
      );
      setForm((prev) => ({
        ...prev,
        ...settings,
        default_trial_days: Number(settings?.default_trial_days ?? prev.default_trial_days),
        smtp_port: Number(settings?.smtp_port ?? prev.smtp_port),
        global_tax_default: Number(settings?.global_tax_default ?? prev.global_tax_default)
      }));
    })();
  }, []);

  function validate() {
    if (!form.system_name.trim()) return "System name is required";
    if (!form.branding_app_name.trim()) return "Branding app name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.support_email.trim())) return "Support email is invalid";
    if (form.default_trial_days < 1) return "Default trial days must be at least 1";
    if (form.smtp_port < 1) return "SMTP port must be at least 1";
    if (form.global_tax_default < 0) return "Global tax default cannot be negative";
    return "";
  }

  const saveSettings = async () => {
    const validationError = validate();
    setError(validationError);
    setSuccess("");
    if (validationError) return;
    setSaving(true);
    try {
      await apiPatch("/super-admin/settings", form);
      setSuccess("Settings saved successfully.");
    } catch (e: any) {
      setError(e?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const checkbox = (key: keyof SettingsForm, label: string) => (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Global Settings" description="System-wide platform settings and defaults." />
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap gap-2 border-b pb-3">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? "bg-indigo-600 text-white" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "general" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium">System name</label>
              <input value={form.system_name} onChange={(e) => setForm((f) => ({ ...f, system_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Support email</label>
              <input value={form.support_email} onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Default trial days</label>
              <input type="number" min={1} value={form.default_trial_days} onChange={(e) => setForm((f) => ({ ...f, default_trial_days: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Default plan</label>
              <select value={form.default_plan_id} onChange={(e) => setForm((f) => ({ ...f, default_plan_id: e.target.value }))}>
                <option value="">Select plan</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Global tax default (%)</label>
              <input type="number" min={0} step="0.01" value={form.global_tax_default} onChange={(e) => setForm((f) => ({ ...f, global_tax_default: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Currency default</label>
              <input value={form.currency_default} onChange={(e) => setForm((f) => ({ ...f, currency_default: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Timezone default</label>
              <input value={form.timezone_default} onChange={(e) => setForm((f) => ({ ...f, timezone_default: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Maintenance mode</label>
              <select value={form.maintenance_mode} onChange={(e) => setForm((f) => ({ ...f, maintenance_mode: e.target.value }))}>
                <option value="off">off</option>
                <option value="read_only">read_only</option>
                <option value="full_lock">full_lock</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium">SMTP host</label>
              <input value={form.smtp_host} onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">SMTP port</label>
              <input type="number" min={1} value={form.smtp_port} onChange={(e) => setForm((f) => ({ ...f, smtp_port: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs font-medium">SMTP user</label>
              <input value={form.smtp_user} onChange={(e) => setForm((f) => ({ ...f, smtp_user: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">SMTP password</label>
              <input type="password" value={form.smtp_password} onChange={(e) => setForm((f) => ({ ...f, smtp_password: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">From email</label>
              <input value={form.smtp_from_email} onChange={(e) => setForm((f) => ({ ...f, smtp_from_email: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">From name</label>
              <input value={form.smtp_from_name} onChange={(e) => setForm((f) => ({ ...f, smtp_from_name: e.target.value }))} />
            </div>
          </div>
        )}

        {activeTab === "storage" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium">Storage driver</label>
              <select value={form.storage_driver} onChange={(e) => setForm((f) => ({ ...f, storage_driver: e.target.value }))}>
                <option value="local">local</option>
                <option value="s3">s3</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium">Bucket</label>
              <input value={form.storage_bucket} onChange={(e) => setForm((f) => ({ ...f, storage_bucket: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Region</label>
              <input value={form.storage_region} onChange={(e) => setForm((f) => ({ ...f, storage_region: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Base URL</label>
              <input value={form.storage_base_url} onChange={(e) => setForm((f) => ({ ...f, storage_base_url: e.target.value }))} />
            </div>
          </div>
        )}

        {activeTab === "branding" && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium">App name</label>
              <input value={form.branding_app_name} onChange={(e) => setForm((f) => ({ ...f, branding_app_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium">Logo URL</label>
              <input value={form.branding_logo_url} onChange={(e) => setForm((f) => ({ ...f, branding_logo_url: e.target.value }))} />
            </div>
          </div>
        )}

        {activeTab === "features" && (
          <div className="grid gap-3 md:grid-cols-2">
            {checkbox("feature_inventory", "Enable inventory module")}
            {checkbox("feature_billing", "Enable billing module")}
            {checkbox("feature_reports", "Enable reports module")}
            {checkbox("feature_hr", "Enable HR module")}
            {checkbox("feature_promotions", "Enable promotions module")}
          </div>
        )}

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

        <button
          type="button"
          className="bg-indigo-600 text-white"
          disabled={saving}
          onClick={saveSettings}
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

