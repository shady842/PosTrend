"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SuperAdminLayout } from "@/components/super-admin/super-admin-layout";

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/super-admin/login") return <>{children}</>;
  return <SuperAdminLayout>{children}</SuperAdminLayout>;
}

