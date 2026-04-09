import Link from "next/link";

type SeoPageProps = {
  h1: string;
  intro: string;
  sections: Array<{ h2: string; points: string[] }>;
  schemaName: string;
  schemaDescription: string;
};

export function SeoPage({ h1, intro, sections, schemaName, schemaDescription }: SeoPageProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: schemaName,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: schemaDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD"
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      <header className="border-b border-slate-200">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href="/" className="text-lg font-bold">PosTrend</Link>
          <div className="flex items-center gap-3">
            <Link href="/pricing" className="text-sm hover:text-indigo-600">Pricing</Link>
            <Link href="/signup" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Start trial</Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-12 md:px-6">
        <h1 className="text-4xl font-extrabold tracking-tight">{h1}</h1>
        <p className="mt-4 text-lg text-slate-600">{intro}</p>

        {sections.map((section) => (
          <section key={section.h2} className="mt-10">
            <h2 className="text-2xl font-bold">{section.h2}</h2>
            <ul className="mt-4 space-y-2 text-slate-700">
              {section.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <span className="mt-2 inline-block h-2 w-2 rounded-full bg-indigo-600" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="mt-12 rounded-2xl bg-indigo-600 px-6 py-8 text-white">
          <h2 className="text-2xl font-bold">Ready to modernize your operations?</h2>
          <h3 className="mt-2 text-indigo-100">Start your free trial or book a tailored demo.</h3>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-white px-5 py-3 font-semibold text-indigo-700">Start trial</Link>
            <Link href="/demo" className="rounded-lg border border-indigo-300 px-5 py-3 font-semibold text-white">Book demo</Link>
          </div>
        </section>
      </main>
    </div>
  );
}

