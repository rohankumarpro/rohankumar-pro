// Shared article helpers.
import { SEED } from "./seed.mjs";
import { cleanBlocks, blocksToMd, mdToBlocks, safeImg, slugify as sl } from "../../shared/blocks.mjs";

const slugify = (t) => sl(t) || "post";
const str = (v, n) => String(v ?? "").slice(0, n);
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

// The day an article was published, as an ISO date, from its display date ("Sep 26, 2026" or "Jul 2026").
export function isoDate(p) {
  if (p?.published && /^\d{4}-\d{2}-\d{2}/.test(p.published)) return p.published.slice(0, 10);
  const m = String(p?.date || "").replace(",", "").split(" ");
  if (m.length === 3 && MON[m[0]] !== undefined) return new Date(Date.UTC(+m[2], MON[m[0]], +m[1])).toISOString().slice(0, 10);
  if (m.length === 2 && MON[m[0]] !== undefined) return new Date(Date.UTC(+m[1], MON[m[0]], 1)).toISOString().slice(0, 10);
  return undefined;
}
// The article as blocks: new articles already are; older ones are converted from their markdown.
export const blocksOf = (p) => (Array.isArray(p.blocks) && p.blocks.length ? p.blocks : mdToBlocks(p.body));
export const isLive = (p, now = Date.now()) => !p.draft && (!p.publishAt || Date.parse(p.publishAt) <= now);

export function cleanPosts(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).slice(0, 300).map((p) => {
    let slug = slugify(p?.slug || p?.title), base = slug, n = 2;
    while (seen.has(slug)) slug = `${base}-${n++}`;
    seen.add(slug);
    const blocks = Array.isArray(p?.blocks) ? cleanBlocks(p.blocks) : null;
    const o = {
      slug,
      title: str(p?.title, 200),
      tag: str(p?.tag, 40),
      date: str(p?.date, 40),
      excerpt: str(p?.excerpt, 400),
      body: blocks && blocks.length ? str(blocksToMd(blocks), 60000) : str(p?.body, 60000),
    };
    if (blocks && blocks.length) o.blocks = blocks;
    for (const k of ["source", "url", "updated", "color", "quote", "hero", "cover", "seoTitle", "seoDesc"]) if (p?.[k]) o[k] = str(p[k], k === "seoDesc" ? 200 : k === "seoTitle" ? 70 : 300);
    const img = safeImg(p?.img); if (img) { o.img = img; if (p?.imgAlt) o.imgAlt = str(p.imgAlt, 200); }
    // the 1200 x 630 picture made from the cover for social shares, and which cover it was made from (so it is remade if that changes)
    const og = safeImg(p?.ogImg); if (og) { o.ogImg = og; if (p?.ogFor) o.ogFor = str(p.ogFor, 300); }
    if (Array.isArray(p?.tags)) o.tags = p.tags.map((t) => str(t, 30).trim()).filter(Boolean).slice(0, 8);
    if (Array.isArray(p?.more)) o.more = p.more.slice(0, 6).map((m) => ({ label: str(m?.label, 80), url: str(m?.url, 300) }));
    if (p?.draft) o.draft = true;
    if (p?.noindex) o.noindex = true;
    if (p?.publishAt && Number.isFinite(Date.parse(p.publishAt))) o.publishAt = new Date(p.publishAt).toISOString();
    const iso = isoDate({ published: p?.published, date: o.date });
    if (iso) o.published = iso;
    o.modified = p?.modified && /^\d{4}-\d{2}-\d{2}/.test(p.modified) ? str(p.modified, 30) : new Date().toISOString();
    return o;
  });
}

export async function loadPosts(store) {
  const saved = await store.get("journal", { type: "json" });
  return Array.isArray(saved) ? saved : SEED;
}
