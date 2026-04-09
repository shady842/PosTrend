"use client";

import { useEffect, useState } from "react";
import { DepartmentManager } from "@/components/hr/department-manager";
import { HrNav } from "@/components/hr/hr-nav";
import { PageHeader } from "@/components/page-header";
import { createDepartment, HrDepartment, listDepartments } from "@/lib/hr-api";
import { useToast } from "@/components/toast";

export default function DepartmentsPage() {
  const { notify } = useToast();
  const [departments, setDepartments] = useState<HrDepartment[]>([]);

  const load = async () => setDepartments(await listDepartments());

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="Departments" description="Create and maintain departments and managers." />
      <HrNav />
      <DepartmentManager
        departments={departments}
        onAdd={async (name, description) => {
          await createDepartment(name, description);
          await load();
          notify("Department added");
        }}
      />
    </div>
  );
}
