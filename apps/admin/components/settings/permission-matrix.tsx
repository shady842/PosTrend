"use client";

type Role = { id: string; name: string };
type Permission = { key: string; label: string };

type Props = {
  roles: Role[];
  permissions: Permission[];
  matrix: Record<string, Record<string, boolean>>;
  onToggle: (roleId: string, permissionKey: string) => void;
};

export function PermissionMatrix({ roles, permissions, matrix, onToggle }: Props) {
  return (
    <div className="card overflow-x-auto p-4">
      <h3 className="mb-3 text-sm font-semibold">Permission Matrix</h3>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700">
            <th className="py-2">Permission</th>
            {roles.map((r) => (
              <th key={r.id} className="py-2">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p.key} className="border-b border-slate-100 dark:border-slate-800">
              <td className="py-3">{p.label}</td>
              {roles.map((r) => (
                <td key={r.id} className="py-3">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(matrix[r.id]?.[p.key])}
                      onChange={() => onToggle(r.id, p.key)}
                    />
                    <span className="text-xs">{matrix[r.id]?.[p.key] ? "Allow" : "Deny"}</span>
                  </label>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
