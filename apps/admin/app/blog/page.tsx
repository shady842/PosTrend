import type { Metadata } from "next";
import Link from "next/link";

type BlogRow = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string;
  author_name: string;
  published_at?: string;
  categories: string[];
  tags: string[];
};

export const metadata: Metadata = {
  title: "Blog | PosTrend",
  description: "Insights, guides, and product updates from PosTrend.",
  openGraph: {
    title: "Blog | PosTrend",
    description: "Insights, guides, and product updates from PosTrend."
  }
};

async function loadBlog(searchParams: Record<string, string | string[] | undefined>) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";
  const params = new URLSearchParams();
  const q = typeof searchParams.q === "string" ? searchParams.q : "";
  const category = typeof searchParams.category === "string" ? searchParams.category : "all";
  const tag = typeof searchParams.tag === "string" ? searchParams.tag : "all";
  if (q.trim()) params.set("q", q.trim());
  if (category !== "all") params.set("category", category);
  if (tag !== "all") params.set("tag", tag);
  const res = await fetch(`${apiBase}/public/blog${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
  const json = await res.json();
  return { q, category, tag, ...json };
}

export default async function BlogPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const data = await loadBlog(searchParams);
  const rows: BlogRow[] = data?.data || [];
  const categories: Array<{ name: string; slug: string }> = data?.categories || [];
  const tags: Array<{ name: string; slug: string }> = data?.tags || [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-4xl font-extrabold">PosTrend Blog</h1>
        <p className="mt-2 text-slate-600">Insights on POS, operations, inventory, accounting, HR, and growth.</p>
        <p className="mt-1 text-sm text-slate-500">{rows.length} published posts</p>
      </div>

      <form className="grid gap-3 md:grid-cols-4">
        <input name="q" defaultValue={data.q} placeholder="Search posts..." />
        <select name="category" defaultValue={data.category}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select name="tag" defaultValue={data.tag}>
          <option value="all">All tags</option>
          {tags.map((t) => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
        <button type="submit">Filter</button>
      </form>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((p) => (
          <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-xl font-bold">
              <Link href={`/blog/${p.slug}`} className="hover:text-indigo-600">{p.title}</Link>
            </h2>
            <p className="mt-2 text-sm text-slate-600">{p.excerpt || p.title}</p>
            <p className="mt-3 text-xs text-slate-500">
              By {p.author_name} {p.published_at ? `• ${new Date(p.published_at).toLocaleDateString()}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.categories.map((c) => <span key={c} className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{c}</span>)}
              {p.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">#{t}</span>)}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

