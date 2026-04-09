"use client";

import { apiGet, apiPost } from "@/lib/api";

export type HrEmployee = {
  id: string;
  fullName: string;
  status: string;
  dateJoined: string;
  role?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  branch?: { id: string; name: string } | null;
};

export type HrDepartment = { id: string; name: string; description?: string | null };
export type HrRole = { id: string; name: string; code: string };

export async function listEmployees() {
  return (await apiGet("/hr/employees")) as HrEmployee[];
}

export async function listRoles() {
  return (await apiGet("/hr/roles")) as HrRole[];
}

export async function listDepartments() {
  return (await apiGet("/hr/departments")) as HrDepartment[];
}

export async function createDepartment(name: string, description?: string) {
  return apiPost("/hr/departments", { name, description });
}
