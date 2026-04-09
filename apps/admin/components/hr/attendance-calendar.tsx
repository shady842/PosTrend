"use client";

type AttendanceRecord = { checkIn: string; status: string };

type Props = {
  month: string;
  attendance: AttendanceRecord[];
};

export function AttendanceCalendar({ month, attendance }: Props) {
  const [year, monthIndex] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthIndex, 0).getDate();

  const dayCount: Record<number, number> = {};
  attendance.forEach((r) => {
    const d = new Date(r.checkIn);
    if (d.getFullYear() === year && d.getMonth() + 1 === monthIndex) {
      const day = d.getDate();
      dayCount[day] = (dayCount[day] || 0) + (r.status === "present" || r.status === "late" ? 1 : 0);
    }
  });

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold">Attendance Calendar</h3>
      <p className="muted mt-1 text-xs">{month}</p>
      <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs">
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const day = idx + 1;
          const present = dayCount[day] || 0;
          return (
            <div key={day} className="rounded-lg border border-slate-200 p-2 dark:border-slate-700">
              <p className="font-medium">{day}</p>
              <p className={present ? "text-emerald-600 dark:text-emerald-400" : "muted"}>
                {present ? `${present} in` : "0 in"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
