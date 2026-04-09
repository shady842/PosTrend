"use client";

export type EmployeeStatus = "active" | "probation" | "on_leave" | "inactive";

export type Employee = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  branch: string;
  departmentId: string;
  status: EmployeeStatus;
  salary: number;
  joinedAt: string;
  documents: Array<{ name: string; uploadedAt: string }>;
};

export type Department = {
  id: string;
  name: string;
  manager: string;
};

export type AttendanceRecord = {
  id: string;
  employeeId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  status: "present" | "late" | "absent";
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  type: "annual" | "sick" | "unpaid";
  startDate: string;
  endDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
};

export type Shift = {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

export type PayrollRun = {
  id: string;
  employeeId: string;
  month: string;
  baseSalary: number;
  overtime: number;
  deduction: number;
  netPay: number;
  status: "pending" | "processed";
};

export type HrState = {
  employees: Employee[];
  departments: Department[];
  attendance: AttendanceRecord[];
  leaves: LeaveRequest[];
  shifts: Shift[];
  payroll: PayrollRun[];
};

const STORAGE_KEY = "pt_hr_state_v1";

const seedState: HrState = {
  departments: [
    { id: "dep-ops", name: "Operations", manager: "Farhan Rahman" },
    { id: "dep-kitchen", name: "Kitchen", manager: "Rizwan Kabir" },
    { id: "dep-cashier", name: "Cashier", manager: "Nadia Islam" }
  ],
  employees: [
    {
      id: "emp-001",
      fullName: "Farhan Rahman",
      email: "farhan@postrend.local",
      phone: "+8801700000001",
      role: "Branch Manager",
      branch: "Dhanmondi",
      departmentId: "dep-ops",
      status: "active",
      salary: 72000,
      joinedAt: "2024-01-10",
      documents: [{ name: "NID.pdf", uploadedAt: "2024-01-10" }]
    },
    {
      id: "emp-002",
      fullName: "Rizwan Kabir",
      email: "rizwan@postrend.local",
      phone: "+8801700000002",
      role: "Kitchen Supervisor",
      branch: "Banani",
      departmentId: "dep-kitchen",
      status: "probation",
      salary: 54000,
      joinedAt: "2025-05-02",
      documents: []
    },
    {
      id: "emp-003",
      fullName: "Nadia Islam",
      email: "nadia@postrend.local",
      phone: "+8801700000003",
      role: "Cashier",
      branch: "Gulshan",
      departmentId: "dep-cashier",
      status: "on_leave",
      salary: 38000,
      joinedAt: "2023-10-11",
      documents: [{ name: "Contract.pdf", uploadedAt: "2023-10-11" }]
    }
  ],
  attendance: [
    { id: "att-1", employeeId: "emp-001", date: "2026-04-06", clockIn: "09:05", clockOut: "18:01", status: "late" },
    { id: "att-2", employeeId: "emp-002", date: "2026-04-06", clockIn: "09:00", clockOut: "17:40", status: "present" },
    { id: "att-3", employeeId: "emp-003", date: "2026-04-06", status: "absent" }
  ],
  leaves: [
    {
      id: "leave-1",
      employeeId: "emp-003",
      type: "annual",
      startDate: "2026-04-09",
      endDate: "2026-04-12",
      reason: "Family event",
      status: "pending"
    }
  ],
  shifts: [
    { id: "shift-1", employeeId: "emp-001", date: "2026-04-08", startTime: "09:00", endTime: "18:00", location: "Dhanmondi" },
    { id: "shift-2", employeeId: "emp-002", date: "2026-04-08", startTime: "10:00", endTime: "19:00", location: "Banani" }
  ],
  payroll: [
    {
      id: "pay-1",
      employeeId: "emp-001",
      month: "2026-04",
      baseSalary: 72000,
      overtime: 2500,
      deduction: 700,
      netPay: 73800,
      status: "pending"
    },
    {
      id: "pay-2",
      employeeId: "emp-002",
      month: "2026-04",
      baseSalary: 54000,
      overtime: 1600,
      deduction: 400,
      netPay: 55200,
      status: "processed"
    }
  ]
};

export function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

export function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function loadHrState(): HrState {
  if (typeof window === "undefined") return seedState;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState;
  try {
    const parsed = JSON.parse(raw) as HrState;
    return parsed;
  } catch {
    return seedState;
  }
}

export function saveHrState(state: HrState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
