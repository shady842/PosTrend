export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h1 className="text-xl font-semibold">Page not found</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            The page you are trying to open does not exist.
          </p>
        </div>
      </div>
    </div>
  );
}
