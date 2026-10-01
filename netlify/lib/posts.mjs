// Shared article helpers.
import { SEED } from "./seed.mjs";

const slugify = (t) =>
  String(t || "").toLowerCase().replace(/\*/g, "").replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "post";
const str = (v, n) => String(v ?? "").slice(0, n);

export function cleanPosts(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).slice(0, 200).map((p) => {
    let slug = slugify(p?.slug || p?.title), base = slug, n = 2;
    while (seen.has(slug)) slug = `${base}-${n++}`;
    seen.add(slug);
    const o = {
      slug,
      title: str(p?.title, 200),
      tag: str(p?.tag, 40),
      date: str(p?.date, 40),
      excerpt: str(p?.excerpt, 400),
      body: str(p?.body, 60000),
    };
    for (const k of ["source", "url", "updated", "color", "quote", "hero", "cover"]) if (p?.[k]) o[k] = str(p[k], 300);
    if (Array.isArray(p?.more)) o.more = p.more.slice(0, 6).map((m) => ({ label: str(m?.label, 80), url: str(m?.url, 300) }));
    if (p?.draft) o.draft = true;
    return o;
  });
}

export async function loadPosts(store) {
  const saved = await store.get("journal", { type: "json" });
  return Array.isArray(saved) ? saved : SEED;
}

