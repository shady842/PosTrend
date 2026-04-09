import Link from "next/link";

type CompareRow = {
  feature: string;
  ours: string;
  competitor: string;
};

type ComparePageProps = {
  competitor: string;
  title: string;
  subtitle: string;
  rows: CompareRow[];
  why: string[];
};

export function ComparePage({ competitor, title, subtitle, rows, why }: ComparePageProps) {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold">PosTrend</Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm hover:text-indigo-600">Pricing</Link>
            <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Start trial</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-10 px-4 py-10 md:px-6">
        <section>
          <p className="mb-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-700">
            Compare with {competitor}
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-3 text-slate-600">{subtitle}</p>
        </section>

        <section className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Feature comparison</th>
                <th className="px-4 py-3 text-left font-semibold">PosTrend</th>
                <th className="px-4 py-3 text-left font-semibold">{competitor}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.feature} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-medium">{r.feature}</td>
                  <td className="px-4 py-3">{r.ours}</td>
                  <td className="px-4 py-3">{r.competitor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-slate-200 p-6">
          <h2 className="text-2xl font-bold">Why choose us</h2>
          <ul className="mt-4 space-y-3 text-slate-700">
            {why.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <span className="mt-2 inline-block h-2 w-2 rounded-full bg-indigo-600" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-indigo-600 px-6 py-8 text-white">
          <h3 className="text-2xl font-bold">Start your free trial today</h3>
          <p className="mt-2 text-indigo-100">See why teams choose PosTrend over {competitor}.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-white px-5 py-3 font-semibold text-indigo-700">Start trial</Link>
            <Link href="/demo" className="rounded-lg border border-indigo-300 px-5 py-3 font-semibold text-white">Book demo</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

