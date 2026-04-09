import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

type Post = {
  title: string;
  excerpt?: string;
  content: string;
  og_image?: string;
  author_name: string;
  published_at?: string;
  categories: string[];
  tags: string[];
};

async function getPost(slug: string): Promise<Post | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/v1";
  const res = await fetch(`${apiBase}/public/blog/${slug}`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Post Not Found | PosTrend Blog" };
  return {
    title: `${post.title} | PosTrend Blog`,
    description: post.excerpt || post.title,
    openGraph: {
      title: post.title,
      description: post.excerpt || post.title,
      images: post.og_image ? [post.og_image] : undefined
    }
  };
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-4 px-4 py-10">
      <Link href="/blog" className="text-sm text-indigo-600 underline">Back to blog</Link>
      <h1 className="text-4xl font-extrabold">{post.title}</h1>
      {post.excerpt ? <p className="text-lg text-slate-600">{post.excerpt}</p> : null}
      <p className="text-sm text-slate-500">
        By {post.author_name} {post.published_at ? `• ${new Date(post.published_at).toLocaleDateString()}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        {post.categories.map((c) => <span key={c} className="rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-700">{c}</span>)}
        {post.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">#{t}</span>)}
      </div>
      <div className="prose max-w-none whitespace-pre-wrap text-slate-800">{post.content}</div>
    </article>
  );
}

