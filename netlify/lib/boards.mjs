// Boards: private infinite canvases. Each board holds floating items (pages, sticky notes, text, pictures, links, sections)
// and connectors between them. Owner only, nothing here is ever shown to visitors.
//
// Storage (new keys only, nothing else is read or written):
//   boards-index          [meta]                         the list of boards
//   board-<id>            {id, items:{}, links:{}, updated, rev, preview}   everything on one board
//   board-stat-<id>       {count, updated, preview, rev}   what the board list shows, kept apart so frequent saves never rewrite the list
//   board-hist-<id>       [{ts, items, links}]           safety copies of a board (every 10 minutes, and before big removals)
//   bpage-<itemId>        {id, blocks, updated}          the writing inside a page card
//   bpage-hist-<itemId>   [{ts, title, blocks}]          earlier versions of that writing
import { cleanBlocks, safeImg, safeUrl, blocksText, wordCount } from "../../shared/blocks.mjs";
import { saveJSON } from "./safe.mjs";
import { ICONS } from "../../shared/icons.mjs";
import { getStore } from "@netlify/blobs";

/* ---------- reading what was really saved last ----------
   Netlify Blobs normally answers reads from an edge cache that can be up to a minute old. A board is read, changed and
   written back on every save, so a stale read would silently undo the save before it. Boards therefore read with strong
   consistency (always the latest). If the platform ever refuses that, reads fall back to normal ones, and the revision
   check in patchBoard still refuses to build on an old copy. */
let strongOk = true;
export function boardsStore(name) {
  const strong = getStore({ name, consistency: "strong" }), plain = getStore(name);
  return {
    async get(key, opts) {
      if (strongOk) {
        try { return await strong.get(key, opts); }
        catch (e) { if (e && e.name === "BlobsConsistencyError") { strongOk = false; console.warn("boards: strong reads unavailable, using revision checks only"); } else throw e; }
      }
      return plain.get(key, opts);
    },
    set: (k, v, o) => plain.set(k, v, o), setJSON: (k, v, o) => plain.setJSON(k, v, o), delete: (k) => plain.delete(k), list: (o) => plain.list(o),
    get strong() { return strongOk; },
  };
}

export const idxKey = "boards-index";
export const boardKey = (id) => `board-${id}`;
export const histKey = (id) => `board-hist-${id}`;
export const pageKey = (id) => `bpage-${id}`;
export const pageHistKey = (id) => `bpage-hist-${id}`;
export const statKey = (id) => `board-stat-${id}`;

const MAX_BOARDS = 200, MAX_ITEMS = 4000, MAX_LINKS = 4000;
const HIST_EVERY = 10 * 60_000, HIST_KEEP = 24, PHIST_EVERY = 5 * 60_000, PHIST_KEEP = 40;
export const COVERS = Array.from({ length: 16 }, (_, i) => "m" + (i + 1));
export const COLORS = ["yellow", "orange", "red", "pink", "purple", "blue", "teal", "green", "grey", "white", "none"];
const TYPES = ["page", "sticky", "text", "image", "link", "frame"];

const str = (v, n) => String(v ?? "").slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 10) / 10)) : d; };
export const okId = (v) => typeof v === "string" && /^[\w-]{4,32}$/.test(v);
const pick = (v, list, d) => (list.includes(v) ? v : d);

export function cleanCover(c) {
  if (!c || typeof c !== "object") return null;
  if (COVERS.includes(c.k)) return { k: c.k };
  const src = safeImg(c.src);
  return src ? { src, fy: num(c.fy, 0, 100, 50) } : null;
}

/* ---------- board list ---------- */
export const loadIndex = async (store) => (await store.get(idxKey, { type: "json" })) ?? [];
// the list with each board's latest count, preview and edit time (kept in its own small record)
export async function listBoards(store) {
  const all = await loadIndex(store);
  const stats = await Promise.all(all.map((m) => store.get(statKey(m.id), { type: "json" }).catch(() => null)));
  return all.map((m, i) => (stats[i] ? { ...m, count: stats[i].count, preview: stats[i].preview || m.preview || [], updated: Math.max(m.updated || 0, stats[i].updated || 0) } : m));
}
const statOf = (doc) => ({ count: Object.keys(doc.items || {}).length, updated: doc.updated, preview: doc.preview || [], rev: doc.rev || 0 });
export const metaOf = (m) => ({ id: m.id, title: m.title || "", icon: m.icon || "", cover: m.cover || null, order: m.order || 0, created: m.created, updated: m.updated, trashed: m.trashed || 0, count: m.count || 0, preview: m.preview || [], fav: !!m.fav });

const cleanPreview = (p) => (Array.isArray(p) ? p : []).slice(0, 90).map((r) => (Array.isArray(r) ? [num(r[0], 0, 1000), num(r[1], 0, 1000), num(r[2], 0, 1000), num(r[3], 0, 1000), pick(r[4], [...COLORS, "page", "image", "frame", "link", "text"], "grey")] : null)).filter(Boolean);
export function cleanMeta(b, prev) {
  const o = { ...prev };
  if ("title" in b) o.title = str(b.title, 120).trim();
  if ("icon" in b) o.icon = ICONS[b.icon] ? b.icon : "";
  if ("cover" in b) o.cover = cleanCover(b.cover);
  if ("order" in b) o.order = num(b.order, -1e9, 1e9, 0);
  if ("fav" in b) o.fav = !!b.fav;
  if ("trashed" in b) o.trashed = b.trashed ? Date.now() : 0;
  if ("preview" in b) o.preview = cleanPreview(b.preview);
  return o;
}

/* ---------- items and connectors ---------- */
export function cleanItem(it) {
  if (!it || typeof it !== "object" || !okId(it.id) || !TYPES.includes(it.t)) return null;
  const o = { id: it.id, t: it.t, x: num(it.x, -1e6, 1e6), y: num(it.y, -1e6, 1e6), w: num(it.w, 20, 20000, 240), h: num(it.h, 20, 20000, 160), z: num(it.z, -1e9, 1e9, 0) };
  if (it.locked) o.locked = true;
  if (it.color) o.color = pick(it.color, COLORS, undefined);
  if (it.parent && okId(it.parent)) o.parent = it.parent; // the section it sits in
  if (it.font === "hand") o.font = "hand"; // handwriting, for notes and text
  if (+it.ts > 0) o.ts = num(it.ts, 0, 9e15, 0); // when it was last changed (the database view sorts by it)
  switch (it.t) {
    case "page":
      o.title = str(it.title, 160); o.icon = ICONS[it.icon] ? it.icon : ""; o.cover = cleanCover(it.cover);
      o.snip = str(it.snip, 320); o.words = num(it.words, 0, 1e7, 0); o.edited = num(it.edited, 0, 9e15, 0);
      break;
    case "sticky": o.text = str(it.text, 6000); o.color = pick(it.color, COLORS, "yellow"); if (it.size) o.size = pick(it.size, ["s", "m", "l"], "m"); break;
    case "text": o.text = str(it.text, 20000); o.size = pick(it.size, ["s", "m", "l", "xl"], "m"); if (it.bold) o.bold = true; if (it.align) o.align = pick(it.align, ["left", "center", "right"], "left"); break;
    case "image": {
      o.src = safeImg(it.src); o.thumb = safeImg(it.thumb) || o.src; o.iw = num(it.iw, 0, 20000, 0); o.ih = num(it.ih, 0, 20000, 0);
      o.name = str(it.name, 160); if (it.cap) o.cap = str(it.cap, 300); if (it.round === false) o.round = false;
      if (!o.src) return null; break;
    }
    case "link": {
      const u = safeUrl(str(it.url, 2000), { relative: false }); if (!/^https?:/i.test(u)) return null;
      o.url = u; o.title = str(it.title, 300); o.desc = str(it.desc, 500); o.img = safeImg(it.img); o.site = str(it.site, 120); o.fav = safeImg(it.fav);
      if (it.yt) o.yt = str(it.yt, 20).replace(/[^\w-]/g, "");
      break;
    }
    case "frame": o.title = str(it.title, 120); o.color = pick(it.color, COLORS, "grey"); break;
  }
  if (o.color === undefined) delete o.color;
  return o;
}

export function cleanLink(l) {
  if (!l || typeof l !== "object" || !okId(l.id) || !okId(l.a) || !okId(l.b) || l.a === l.b) return null;
  const sides = ["auto", "t", "r", "b", "l"];
  const o = { id: l.id, a: l.a, b: l.b, as: pick(l.as, sides, "auto"), bs: pick(l.bs, sides, "auto"), style: pick(l.style, ["curve", "straight", "elbow"], "curve"), ends: pick(l.ends, ["end", "both", "none"], "end"), color: pick(l.color, COLORS, "grey") };
  if (l.dash) o.dash = true;
  if (l.label) o.label = str(l.label, 200);
  if (l.w) o.w = pick(+l.w, [1, 2, 3], 2);
  return o;
}

/* ---------- boards ---------- */
export async function createBoard(store, b) {
  const all = await loadIndex(store);
  if (all.filter((x) => !x.trashed).length >= MAX_BOARDS) throw Object.assign(new Error("full"), { code: 400, msg: "You have the most boards allowed (200)" });
  const id = okId(b.id) && !all.some((x) => x.id === b.id) ? b.id : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();
  const meta = cleanMeta({ title: b.title ?? "", icon: b.icon ?? "", cover: b.cover ?? null }, { id, title: "", icon: "", cover: null, order: Math.min(0, ...all.map((x) => x.order || 0)) - 1, created: now, updated: now, trashed: 0, count: 0, preview: [] });
  const doc = { id, items: {}, links: {}, updated: now, rev: 1, preview: [] };
  for (const it of Array.isArray(b.items) ? b.items.slice(0, MAX_ITEMS) : []) { const c = cleanItem(it); if (c) doc.items[c.id] = c; }
  for (const l of Array.isArray(b.links) ? b.links.slice(0, MAX_LINKS) : []) { const c = cleanLink(l); if (c && doc.items[c.a] && doc.items[c.b]) doc.links[c.id] = c; }
  meta.count = Object.keys(doc.items).length;
  await store.setJSON(boardKey(id), doc); // the board first, so a save that arrives right away always finds it
  await store.setJSON(statKey(id), statOf(doc));
  await saveJSON(store, idxKey, [...all, meta]);
  return { meta, doc };
}

export async function loadBoard(store, id) {
  return (await store.get(boardKey(id), { type: "json" })) ?? { id, items: {}, links: {}, updated: 0, rev: 0 };
}

// the order boards are listed in (the owner drags them in the sidebar)
export async function reorder(store, ids) {
  const all = await loadIndex(store), pos = new Map((Array.isArray(ids) ? ids : []).filter(okId).map((id, i) => [id, i]));
  if (!pos.size) return all;
  for (const m of all) if (pos.has(m.id)) m.order = pos.get(m.id);
  await saveJSON(store, idxKey, all);
  return all;
}

export async function updateMeta(store, id, b) {
  const all = await loadIndex(store), i = all.findIndex((x) => x.id === id);
  if (i < 0) return null;
  all[i] = cleanMeta(b, all[i]);
  if (!("preview" in b) || Object.keys(b).length > 1) all[i].updated = Date.now();
  await saveJSON(store, idxKey, all);
  return all[i];
}

// A change sent by the editor: items and connectors to add or replace, and ids to remove, applied to the latest saved
// board (so edits from two tabs both survive; the last change to the same item wins).
// Every save carries `base`, the revision the editor last saw saved. If the copy read here is older than that, it is a
// stale read: nothing is written and the editor is told to send its whole board instead ({stale}).
// A `full` save carries the whole board and replaces what is stored.
export async function patchBoard(store, id, p) {
  let doc = await store.get(boardKey(id), { type: "json" });
  const base = p.base != null && Number.isFinite(+p.base) ? +p.base : null;
  if (!doc) {
    // not found: either it never existed, or this read is older than the board itself (the editor saw it saved)
    if (base > 0 && !p.full) return { stale: true, rev: 0 };
    if (!(base > 0) && !(await loadIndex(store)).some((x) => x.id === id)) return null;
    doc = { id, items: {}, links: {}, updated: 0, rev: 0 };
  }
  const rev = doc.rev || 0;
  if (base != null && base > rev && !p.full) return { stale: true, rev };
  const before = Object.keys(doc.items || {}).length, prevItems = doc.items || {}, prevLinks = doc.links || {};
  if (p.full) { doc.items = {}; doc.links = {}; } else { doc.items = { ...prevItems }; doc.links = { ...prevLinks }; }
  for (const it of Array.isArray(p.full ? p.items : p.up) ? (p.full ? p.items : p.up) : []) { const c = cleanItem(it); if (c) doc.items[c.id] = c; }
  if (!p.full) for (const k of Array.isArray(p.del) ? p.del : []) if (okId(k)) delete doc.items[k];
  for (const l of Array.isArray(p.full ? p.links : p.lup) ? (p.full ? p.links : p.lup) : []) { const c = cleanLink(l); if (c) doc.links[c.id] = c; }
  if (!p.full) for (const k of Array.isArray(p.ldel) ? p.ldel : []) if (okId(k)) delete doc.links[k];
  for (const [k, l] of Object.entries(doc.links)) if (!doc.items[l.a] || !doc.items[l.b]) delete doc.links[k]; // a connector never points at nothing
  if (Object.keys(doc.items).length > MAX_ITEMS) throw Object.assign(new Error("full"), { code: 400, msg: `A board holds at most ${MAX_ITEMS} items` });
  // safety copy: every ten minutes, and always before a change that removes most of the board
  const after = Object.keys(doc.items).length, shrunk = before >= 8 && after < before * 0.5;
  try {
    const hist = (await store.get(histKey(id), { type: "json" })) ?? [];
    if (before && (shrunk || !hist.length || Date.now() - hist[0].ts > HIST_EVERY)) await store.setJSON(histKey(id), [{ ts: Date.now(), items: prevItems, links: prevLinks }, ...hist].slice(0, HIST_KEEP));
  } catch {}
  if (p.meta && typeof p.meta === "object" && "preview" in p.meta) doc.preview = cleanPreview(p.meta.preview);
  doc.updated = Date.now(); doc.rev = Math.max(rev, base || 0) + 1;
  await store.setJSON(boardKey(id), doc);
  const stat = statOf(doc);
  await store.setJSON(statKey(id), stat);
  return { stat, rev: doc.rev, updated: doc.updated };
}

export async function purgeBoard(store, id, bk) {
  const all = await loadIndex(store), m = all.find((x) => x.id === id);
  if (!m) return false;
  const doc = await loadBoard(store, id);
  const pageIds = Object.values(doc.items).filter((x) => x.t === "page").map((x) => x.id);
  if (bk) { // a last safety copy, kept in the separate backup store
    try {
      const pages = {}; for (const pid of pageIds) pages[pid] = await store.get(pageKey(pid), { type: "json" });
      await bk.setJSON(`purged-board-${Date.now()}-${id}`, { kind: "board-purged", ts: Date.now(), meta: m, doc, pages });
    } catch {}
  }
  await saveJSON(store, idxKey, all.filter((x) => x.id !== id));
  await store.delete(boardKey(id)); await store.delete(histKey(id)); await store.delete(statKey(id));
  for (const pid of pageIds) { await store.delete(pageKey(pid)); await store.delete(pageHistKey(pid)); }
  return true;
}

/* ---------- the writing inside a page card ---------- */
export async function loadPage(store, id) { return (await store.get(pageKey(id), { type: "json" })) ?? { id, blocks: [], updated: 0 }; }

export async function savePage(store, id, b) {
  const blocks = cleanBlocks(b.blocks), cur = await store.get(pageKey(id), { type: "json" });
  // an older copy (another tab or device saved since): refuse, and let the editor keep both
  if (cur && b.base != null && (cur.updated || 0) > +b.base && !b.force) return { conflict: true, current: cur };
  if (cur && cur.blocks?.length) {
    const hist = (await store.get(pageHistKey(id), { type: "json" })) ?? [];
    const was = wordCount(cur.blocks), now = wordCount(blocks), shrunk = was >= 20 && now < was * 0.4;
    if (!hist.length || shrunk || Date.now() - hist[0].ts > PHIST_EVERY) await store.setJSON(pageHistKey(id), [{ ts: Date.now(), title: str(b.title, 160), blocks: cur.blocks }, ...hist].slice(0, PHIST_KEEP));
  }
  const doc = { id, blocks, updated: Date.now() };
  await store.setJSON(pageKey(id), doc);
  return { doc, words: wordCount(blocks), snip: blocksText(blocks, " ").replace(/\s+/g, " ").trim().slice(0, 320) };
}

/* ---------- link previews ---------- */
const PRIVATE = /^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?|\[?f[cd]|.*\.(internal|local|localhost)$)/i;
const ent = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
export function ytId(u) {
  try { const x = new URL(u), h = x.hostname.replace(/^www\.|^m\./, "");
    if (h === "youtu.be") return x.pathname.slice(1, 12);
    if (h.endsWith("youtube.com")) return x.searchParams.get("v") || (x.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/) || [])[2] || "";
  } catch {} return "";
}
export async function unfurl(raw) {
  let u; try { u = new URL(String(raw).trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) return null;
  const site = u.hostname.replace(/^www\./, ""), out = { url: u.href, site, title: "", desc: "", img: "", fav: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64` };
  const yt = ytId(u.href);
  if (yt) {
    out.yt = yt; out.img = `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`; out.site = "YouTube";
    try { const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(u.href)}`, { signal: AbortSignal.timeout(4000) }); if (r.ok) { const j = await r.json(); out.title = str(j.title, 300); out.desc = str(j.author_name, 200); } } catch {}
    return out;
  }
  try {
    const r = await fetch(u.href, { redirect: "follow", signal: AbortSignal.timeout(5000), headers: { "user-agent": "Mozilla/5.0 (compatible; rohankumar.pro link preview)", accept: "text/html,*/*;q=0.5" } });
    if (!r.ok || !/html/i.test(r.headers.get("content-type") || "")) return out;
    const reader = r.body.getReader(); let html = "", size = 0;
    while (size < 400_000) { const { done, value } = await reader.read(); if (done) break; size += value.length; html += new TextDecoder().decode(value); if (/<\/head>/i.test(html)) break; }
    try { reader.cancel(); } catch {}
    const meta = (k) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, "i")); return m ? ent((m[0].match(/content=["']([^"']*)["']/i) || [])[1]) : ""; };
    out.title = str(meta("og:title") || meta("twitter:title") || ent((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]), 300);
    out.desc = str(meta("og:description") || meta("description") || meta("twitter:description"), 500);
    const img = meta("og:image") || meta("twitter:image");
    if (img) { try { out.img = safeImg(new URL(img, u.href).href); } catch {} }
    const sn = meta("og:site_name"); if (sn) out.site = str(sn, 120);
  } catch {}
  return out;
}
