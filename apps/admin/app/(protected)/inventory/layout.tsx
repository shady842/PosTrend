import { ReactNode } from "react";
import { InventoryNav } from "@/components/inventory/inventory-nav";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <InventoryNav />
      {children}
    </div>
  );
}
