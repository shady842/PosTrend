"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { HrNav } from "@/components/hr/hr-nav";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPost } from "@/lib/api";

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<any | null>(null);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docName, setDocName] = useState("");

  useEffect(() => {
    void (async () => {
      const [emps, att, docs] = await Promise.all([
        apiGet("/hr/employees"),
        apiGet(`/hr/attendance?employee_id=${params.id}`),
        apiGet(`/hr/employees/${params.id}/documents`)
      ]);
      const rows = Array.isArray(emps) ? emps : [];
      setEmployee(rows.find((e) => e.id === params.id) || null);
      setAttendance(Array.isArray(att) ? att : []);
      setDocuments(Array.isArray(docs) ? docs : []);
    })();
  }, [params.id]);

  if (!employee) {
    return (
      <div className="space-y-4">
        <PageHeader title="Employee Profile" description="Employee not found." />
        <HrNav />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={employee.fullName} description={`${employee.role?.name || "Role"} • ${employee.branch?.name || "Branch"}`} />
      <HrNav />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-1">
          <h3 className="text-sm font-semibold">Employee Profile</h3>
          <div className="mt-3 space-y-2 text-sm">
            <p className="muted">Status: {employee.status}</p>
            <p className="muted">Department: {employee.department?.name || "N/A"}</p>
            <p className="muted">Joined: {String(employee.dateJoined).slice(0, 10)}</p>
          </div>
        </div>

        <div className="card p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold">Upload Documents</h3>
          <div className="mt-3 flex gap-2">
            <input placeholder="Document name (e.g. OfferLetter.pdf)" value={docName} onChange={(e) => setDocName(e.target.value)} />
            <button
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white"
              onClick={() => {
                const name = docName.trim();
                if (!name) return;
                void (async () => {
                  await apiPost(`/hr/employees/${employee.id}/documents`, { name });
                  const docs = await apiGet(`/hr/employees/${params.id}/documents`);
                  setDocuments(Array.isArray(docs) ? docs : []);
                  setDocName("");
                })();
              }}
            >
              Upload
            </button>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {documents.map((d: any) => (
              <div key={d.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                {String(d.metadata?.name || "Document")} <span className="muted">({String(d.createdAt).slice(0, 10)})</span>
              </div>
            ))}
            {!documents.length ? <p className="muted text-xs">No documents uploaded yet.</p> : null}
          </div>
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-semibold">Clock In/Out Viewer (Attendance Timeline)</h3>
        <div className="mt-3 space-y-2 text-sm">
          {attendance.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <span className="font-medium">{String(a.checkIn).slice(0, 10)}</span> - In: {String(a.checkIn).slice(11, 16)} - Out:{" "}
              {a.checkOut ? String(a.checkOut).slice(11, 16) : "--:--"} -{" "}
              <span className="uppercase">{a.status}</span>
            </div>
          ))}
          {!attendance.length ? <p className="muted text-xs">No attendance records.</p> : null}
        </div>
      </div>
    </div>
  );
}
