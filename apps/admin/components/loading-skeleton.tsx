export function LoadingSkeleton() {
  return (
    <div className="card animate-pulse p-4">
      <div className="mb-2 h-4 w-32 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="mb-2 h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
      <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
