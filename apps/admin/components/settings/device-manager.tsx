"use client";

type Device = { id: string; name: string; code: string; status: string };

type Props = {
  rows: Device[];
  onToggle: (id: string) => void;
};

export function DeviceManager({ rows, onToggle }: Props) {
  return (
    <div className="card overflow-x-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Device Manager</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
            <th className="py-2">Name</th>
            <th className="py-2">Code</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d) => (
            <tr key={d.id} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-3">{d.name}</td>
              <td className="py-3">{d.code}</td>
              <td className="py-3 capitalize">{d.status}</td>
              <td className="py-3 text-right">
                <button className="rounded-lg bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800" onClick={() => onToggle(d.id)}>
                  {d.status === "active" ? "Disable" : "Enable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
