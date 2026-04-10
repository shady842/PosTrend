"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <div className="mx-auto flex min-h-screen max-w-xl items-center px-6">
            <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h1 className="text-xl font-semibold">Application error</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                A critical rendering error occurred. Please refresh or retry.
              </p>
              {error?.digest ? (
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Digest: {error.digest}</p>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
