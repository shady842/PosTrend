"use client";

import { useEffect, useMemo, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { AttendanceCalendar } from "@/components/hr/attendance-calendar";
import { HrNav } from "@/components/hr/hr-nav";
import { PageHeader } from "@/components/page-header";
import { ChartCard } from "@/components/chart-card";
import { apiGet } from "@/lib/api";

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<any[]>([]);

  useEffect(() => {
    void (async () => {
      const data = await apiGet("/hr/attendance");
      setAttendance(Array.isArray(data) ? data : []);
    })();
  }, []);

  const timeline = useMemo(() => {
    return attendance
      .slice()
      .sort((a, b) => String(a.checkIn).localeCompare(String(b.checkIn)))
      .map((a) => ({
        date: String(a.checkIn).slice(5, 10),
        value: a.status === "present" ? 1 : a.status === "late" ? 0.75 : 0
      }));
  }, [attendance]);

  const overview = useMemo(() => {
    const result = { present: 0, late: 0, absent: 0 };
    attendance.forEach((a) => {
      const key = a.status as "present" | "late" | "absent";
      if (key in result) result[key] += 1;
    });
    return [
      { label: "Present", value: result.present },
      { label: "Late", value: result.late },
      { label: "Absent", value: result.absent }
    ];
  }, [attendance]);

  return (
    <div className="space-y-4">
      <PageHeader title="Attendance" description="Calendar view, timeline, and attendance overview." />
      <HrNav />
      <div className="grid gap-4 lg:grid-cols-2">
        <AttendanceCalendar month={new Date().toISOString().slice(0, 7)} attendance={attendance} />
        <ChartCard title="Attendance Overview" subtitle="Present vs Late vs Absent">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-semibold">Attendance Timeline</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {timeline.map((t, idx) => (
            <div key={`${t.date}-${idx}`} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-medium">{t.date}</p>
              <p className="muted text-xs">Attendance score: {Math.round(t.value * 100)}%</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
