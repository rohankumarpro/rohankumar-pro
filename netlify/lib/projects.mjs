// Projects: cleaning, storage helpers and the public shape. Each project is its own record plus a small index for fast lists.
import { cleanBlocks, cleanInline, slugify, safeImg, safeUrl, blocksText, wordCount, rid, stripTags } from "../../shared/blocks.mjs";

const str = (v, n) => String(v ?? "").trim().slice(0, n);
const COLORS = ["c1", "c2", "c3", "c4", "c5", "c6"];
export const LICENSES = { "all-rights": "All rights reserved", "cc-by": "CC BY 4.0", "cc-by-sa": "CC BY-SA 4.0", "cc-by-nc": "CC BY-NC 4.0", "cc-by-nd": "CC BY-ND 4.0", "cc-by-nc-sa": "CC BY-NC-SA 4.0", "cc0": "CC0 (public domain)" };
const pct = (v) => (Number.isFinite(+v) && v !== "" && v != null ? Math.max(0, Math.min(100, Math.round(+v))) : 50);
const list = (v, n, m) => (Array.isArray(v) ? v : []).map((x) => str(x, m)).filter(Boolean).slice(0, n);

export function cleanProject(p, prev = {}) {
  const o = {
    id: /^[\w-]{3,24}$/.test(p?.id || "") ? p.id : (prev.id || rid() + rid().slice(0, 4)),
    title: str(p?.title, 160), summary: str(p?.summary, 400), field: str(p?.field, 60),
    tags: list(p?.tags, 12, 30), tools: list(p?.tools, 20, 40), year: str(p?.year, 10), client: str(p?.client, 80), role: str(p?.role, 80),
    color: COLORS.includes(p?.color) ? p.color : "c2",
    status: ["published", "draft", "unlisted"].includes(p?.status) ? p.status : "draft",
    featured: !!p?.featured, license: LICENSES[p?.license] ? p.license : "all-rights",
    blocks: cleanBlocks(p?.blocks),
    ts: Number(prev.ts || p?.ts) || Date.now(), updated: Date.now(),
  };
  const src = safeImg(p?.cover?.src);
  if (src) o.cover = { src, fx: pct(p.cover.fx), fy: pct(p.cover.fy), alt: str(p.cover.alt, 200) };
  const link = safeUrl(p?.link, { relative: false }); if (link) o.link = link;
  o.links = (Array.isArray(p?.links) ? p.links : []).slice(0, 12).map((l) => ({ label: str(l?.label, 40), url: safeUrl(l?.url, { relative: false }) })).filter((l) => l.label && l.url);
  o.credits = (Array.isArray(p?.credits) ? p.credits : []).slice(0, 20).map((c) => ({ name: str(c?.name, 80), role: str(c?.role, 80), url: safeUrl(c?.url, { relative: false }) })).filter((c) => c.name);
  const seo = { title: str(p?.seo?.title, 70), desc: str(p?.seo?.desc, 200), image: safeImg(p?.seo?.image) };
  if (seo.title || seo.desc || seo.image) o.seo = seo;
  if (o.status === "published") o.publishedAt = Number(prev.publishedAt || p?.publishedAt) || Date.now();
  else if (prev.publishedAt) o.publishedAt = prev.publishedAt;
  o.slug = slugify(p?.slug || o.title) || "project";
  return o;
}

export const metaOf = (p) => ({
  id: p.id, slug: p.slug, title: p.title, summary: p.summary, field: p.field, tags: p.tags, tools: p.tools, year: p.year, client: p.client, role: p.role,
  color: p.color, cover: p.cover, status: p.status, featured: p.featured, ts: p.ts, updated: p.updated, publishedAt: p.publishedAt, link: p.link,
  words: wordCount(p.blocks),
});

// Until the owner saves the first real project, the list comes from the old Projects settings (or the starter set).
export function seedProjects(settings) {
  const old = Array.isArray(settings?.projects) && settings.projects.length ? settings.projects : [
    { title: "Project one", cat: "Web", year: "2026", color: "c2", desc: "A short description of the project: the problem, your role, and the result." },
    { title: "Project two", cat: "Design", year: "2025", color: "c3", desc: "A short description of the project: the problem, your role, and the result." },
    { title: "Project three", cat: "Web", year: "2025", color: "c5", desc: "A short description of the project: the problem, your role, and the result." },
    { title: "Project four", cat: "Design", year: "2024", color: "c6", desc: "A short description of the project: the problem, your role, and the result." },
  ];
  return old.map((p, i) => {
    const o = cleanProject({ id: `seed${i + 1}`, title: p.title, summary: p.desc, field: p.cat, year: p.year, color: p.color, link: p.link && p.link !== "#" ? p.link : "", status: p.hidden ? "draft" : "published",
      blocks: p.desc ? [{ t: "p", h: cleanInline(p.desc) }] : [] });
    o.ts = Date.now() - i * 1000; return o;
  });
}

export async function loadIndex(store) {
  const idx = await store.get("projects-index", { type: "json" });
  return Array.isArray(idx) ? idx : null;
}
export const projKey = (id) => `project-${id}`;
export async function loadProject(store, id) { return store.get(projKey(id), { type: "json" }); }
export function uniqueSlug(slug, id, metas) {
  let s = slug, n = 2; while (metas.some((m) => m.slug === s && m.id !== id)) s = `${slug}-${n++}`; return s;
}
export const publicList = (metas) => metas.filter((m) => m.status === "published");
