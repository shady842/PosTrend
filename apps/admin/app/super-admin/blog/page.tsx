"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type BlogPostRow = {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  status: string;
  categories: string[];
  tags: string[];
  published_at?: string;
};

export default function SuperAdminBlogPage() {
  const [rows, setRows] = useState<BlogPostRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    categories: "",
    tags: ""
  });

  const selected = useMemo(() => rows.find((r) => r.id === selectedId), [rows, selectedId]);

  const load = async () => {
    const res = await apiGet("/super-admin/blog/posts");
    setRows(res || []);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm({
      title: selected.title || "",
      slug: selected.slug || "",
      excerpt: selected.excerpt || "",
      content: selected.content || "",
      categories: (selected.categories || []).join(", "),
      tags: (selected.tags || []).join(", ")
    });
  }, [selected]);

  const submitCreate = async () => {
    setSaving(true);
    try {
      await apiPost("/super-admin/blog/posts", {
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt || undefined,
        content: form.content,
        categories: form.categories.split(",").map((x) => x.trim()).filter(Boolean),
        tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean)
      });
      setForm({ title: "", slug: "", excerpt: "", content: "", categories: "", tags: "" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const submitUpdate = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await apiPatch(`/super-admin/blog/posts/${selectedId}`, {
        title: form.title,
        slug: form.slug || undefined,
        excerpt: form.excerpt || undefined,
        content: form.content,
        categories: form.categories.split(",").map((x) => x.trim()).filter(Boolean),
        tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean)
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const publish = async (id: string) => {
    setSaving(true);
    try {
      await apiPost(`/super-admin/blog/posts/${id}/publish`, {});
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Blog CMS" description="Create, edit, and publish blog posts." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-4 lg:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th>Title</th><th>Status</th><th>Slug</th><th>Published</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td>{r.title}</td>
                    <td>{r.status}</td>
                    <td>{r.slug}</td>
                    <td>{r.published_at ? new Date(r.published_at).toLocaleDateString() : "-"}</td>
                    <td className="space-x-2">
                      <button type="button" onClick={() => setSelectedId(r.id)}>Edit</button>
                      {r.status !== "published" ? <button type="button" onClick={() => void publish(r.id)}>Publish</button> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <h3 className="font-semibold">{selectedId ? "Edit Post" : "Create Post"}</h3>
          <input placeholder="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <input placeholder="Slug (optional)" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
          <input placeholder="Excerpt" value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} />
          <textarea placeholder="Content" rows={8} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} />
          <input placeholder="Categories (comma separated)" value={form.categories} onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))} />
          <input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
          <div className="flex gap-2">
            {!selectedId ? (
              <button type="button" className="bg-indigo-600 text-white" disabled={saving} onClick={() => void submitCreate()}>
                {saving ? "Saving..." : "Create post"}
              </button>
            ) : (
              <>
                <button type="button" className="bg-indigo-600 text-white" disabled={saving} onClick={() => void submitUpdate()}>
                  {saving ? "Saving..." : "Update post"}
                </button>
                <button type="button" onClick={() => setSelectedId("")}>New</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

