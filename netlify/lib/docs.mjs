// Docs: a private workspace of pages inside pages (like Notion). Each page is its own record plus one small index.
// Pages are private. The owner can "Publish to web" one page (and its address, /docs/<slug>, gets the same SEO as the Journal).
import { cleanBlocks, slugify, safeImg, rid, blocksText, wordCount } from "../../shared/blocks.mjs";
import { saveJSON } from "./safe.mjs";

const str = (v, n) => String(v ?? "").trim().slice(0, n);
export const GRADS = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"];
const MAX_PAGES = 600, HIST_EVERY = 10 * 60_000, HIST_KEEP = 8;
export const idxKey = "docs-index";
export const pageKey = (id) => `doc-${id}`;
export const histKey = (id) => `doc-hist-${id}`;

export const metaOf = (m) => ({ id: m.id, title: m.title, icon: m.icon, parent: m.parent || null, order: m.order || 0, fav: !!m.fav, pub: !!m.pub, slug: m.slug, cover: m.cover || null, desc: m.desc || "", noindex: !!m.noindex, created: m.created, updated: m.updated, trashed: m.trashed || 0, words: m.words || 0 });
export const loadIndex = async (store) => (await store.get(idxKey, { type: "json" })) ?? [];

export function cleanMeta(b, prev = {}, all = []) {
  const o = { ...prev };
  if ("title" in b) o.title = str(b.title, 160);
  if ("icon" in b) o.icon = str(b.icon, 8);
  if ("desc" in b) o.desc = str(b.desc, 200);
  if ("fav" in b) o.fav = !!b.fav;
  if ("noindex" in b) o.noindex = !!b.noindex;
  if ("pub" in b) o.pub = !!b.pub;
  if ("order" in b) o.order = Math.max(0, Math.min(1e9, +b.order || 0));
  if ("cover" in b) {
    if (!b.cover) o.cover = null;
    else if (GRADS.includes(b.cover.grad)) o.cover = { grad: b.cover.grad };
    else { const src = safeImg(b.cover.src); o.cover = src ? { src, fy: Math.max(0, Math.min(100, Math.round(+b.cover.fy || 50))) } : null; }
  }
  if ("parent" in b) {
    const p = b.parent && all.find((x) => x.id === b.parent && x.id !== prev.id) ? b.parent : null;
    // never move a page inside its own descendant
    let cur = p, ok = true; for (let i = 0; cur && i < 50; i++) { if (cur === prev.id) { ok = false; break; } cur = (all.find((x) => x.id === cur) || {}).parent; }
    if (ok) o.parent = p;
  }
  if (!o.title && o.title !== "") o.title = "";
  if (o.title == null) o.title = "";
  if ("slug" in b || (o.pub && !o.slug)) {
    let base = slugify(b.slug || o.slug || o.title) || "page", slug = base, n = 2;
    while (all.some((x) => x.id !== o.id && x.slug === slug)) slug = `${base}-${n++}`;
    o.slug = slug;
  }
  return o;
}

export async function createPage(store, b) {
  const all = await loadIndex(store);
  if (all.length >= MAX_PAGES) throw Object.assign(new Error("full"), { code: 400, msg: "The workspace is full (600 pages)" });
  const id = rid() + rid().slice(0, 4), now = Date.now();
  const sib = all.filter((x) => (x.parent || null) === (b.parent || null) && !x.trashed);
  const base = { id, title: "", icon: "", parent: null, order: (Math.max(-1, ...sib.map((x) => x.order || 0)) + 1), fav: false, pub: false, slug: "", cover: null, desc: "", noindex: false, created: now, updated: now, trashed: 0, words: 0 };
  const meta = cleanMeta({ title: b.title ?? "", icon: b.icon ?? "", parent: b.parent || null, cover: b.cover, desc: b.desc }, base, all);
  const blocks = cleanBlocks(b.blocks);
  meta.words = wordCount(blocks);
  await saveJSON(store, idxKey, [...all, meta]);
  await store.setJSON(pageKey(id), { id, blocks, updated: now });
  return { meta, blocks };
}

export async function updatePage(store, id, b) {
  const all = await loadIndex(store), i = all.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const meta = cleanMeta(b, all[i], all);
  let blocks = null;
  if (Array.isArray(b.blocks)) {
    blocks = cleanBlocks(b.blocks); meta.words = wordCount(blocks);
    const cur = await store.get(pageKey(id), { type: "json" });
    // a rolling history: at most one snapshot every ten minutes, the last eight kept
    if (cur && cur.blocks?.length) {
      const hist = (await store.get(histKey(id), { type: "json" })) ?? [];
      if (!hist.length || Date.now() - hist[0].ts > HIST_EVERY) await store.setJSON(histKey(id), [{ ts: Date.now(), title: all[i].title, blocks: cur.blocks }, ...hist].slice(0, HIST_KEEP));
    }
  }
  if ("trashed" in b) { // moving to the bin takes the whole branch with it; restoring brings the whole branch back
    const t = b.trashed ? Date.now() : 0, kids = new Set([id]); let grew = true;
    while (grew) { grew = false; for (const x of all) if (x.parent && kids.has(x.parent) && !kids.has(x.id)) { kids.add(x.id); grew = true; } }
    for (const x of all) if (kids.has(x.id)) { x.trashed = t; if (t) x.pub = false; }
    meta.trashed = t; if (t) meta.pub = false;
    if (!t && meta.parent && all.find((x) => x.id === meta.parent)?.trashed) meta.parent = null;
  }
  meta.updated = Date.now();
  all[i] = meta;
  await saveJSON(store, idxKey, all);
  if (blocks) await store.setJSON(pageKey(id), { id, blocks, updated: meta.updated });
  return { meta, blocks, index: all };
}

export async function purge(store, id) {
  const all = await loadIndex(store), kids = new Set([id]); let grew = true;
  while (grew) { grew = false; for (const x of all) if (x.parent && kids.has(x.parent) && !kids.has(x.id)) { kids.add(x.id); grew = true; } }
  if (!all.some((x) => kids.has(x.id))) return false;
  await saveJSON(store, idxKey, all.filter((x) => !kids.has(x.id)));
  for (const k of kids) { await store.delete(pageKey(k)); await store.delete(histKey(k)); }
  return true;
}

// What visitors may see: published pages that are not in the bin.
export const publicMetas = (all) => all.filter((m) => m.pub && !m.trashed).map(metaOf);
export const textOf = (blocks) => blocksText(blocks);
