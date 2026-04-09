"use client";

import { apiPost } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ItemMasterWizard } from "@/components/inventory/item-master-wizard";
import { useToast } from "@/components/toast";

export default function ItemMasterPage() {
  const { notify } = useToast();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Item Master Wizard"
        description="Enterprise item creation with UOM, pricing, supplier, stock rules, recipe, and accounting mapping."
      />
      <div className="card p-4">
        <ItemMasterWizard
          onSubmit={async (payload) => {
            const basic = payload as Record<string, string | boolean>;
            await apiPost("/inventory/items", {
              name: basic.name,
              sku: basic.sku,
              reorder_point: Number(basic.reorderLevel || 0),
              stock_level: Number(basic.parLevel || 0),
              concept_wide: true
            });
            notify("Item created. Extended enterprise attributes captured for next hardening phase.");
          }}
        />
      </div>
    </div>
  );
}
