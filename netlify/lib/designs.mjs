// Design: the owner's own design tool (frames, shapes, text, pictures), and decks presented from it.
// Owner only, except a deck the owner chose to share with a private link (view and present, nothing else).
//
// Storage (new keys only, nothing else is read or written):
//   designs-index            [meta]                                  the list of designs
//   design-<id>              {id, nodes:{}, slides:[], bg, rev, updated}   everything in one design
//   design-stat-<id>         {count, updated, thumb, rev}            what the list shows (kept apart so saves never rewrite the list)
//   design-hist-<id>         [{ts, nodes, slides, bg}]               safety copies (every 10 minutes, and before big removals)
//   design-share-<token>     {id, on}                                a private link the owner switched on (off again: on:false)
import { safeImg } from "../../shared/blocks.mjs";
import { saveJSON } from "./safe.mjs";
import { boardsStore } from "./boards.mjs";

export const designsStore = boardsStore; // the same strong-read store wrapper Boards uses
export const idxKey = "designs-index";
export const docKey = (id) => `design-${id}`;
export const statKey = (id) => `design-stat-${id}`;
export const histKey = (id) => `design-hist-${id}`;
export const shareKey = (t) => `design-share-${t}`;

const MAX_DESIGNS = 300, MAX_NODES = 6000, HIST_EVERY = 10 * 60_000, HIST_KEEP = 24;
export const okId = (v) => typeof v === "string" && /^[\w-]{4,32}$/.test(v);
export const okToken = (v) => typeof v === "string" && /^[A-Za-z0-9]{20,40}$/.test(v);
const num = (v, lo, hi, d = 0) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n * 100) / 100)) : d; };
const str = (v, n) => String(v ?? "").slice(0, n);
const pick = (v, list, d) => (list.includes(v) ? v : d);
const hex = (v, d = "#000000") => (typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : d);
const TYPES = ["frame", "rect", "ellipse", "line", "polygon", "star", "text", "group", "bool"];
const BLENDS = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light", "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity"];
const FONT = /^[A-Za-z0-9 ]{1,60}$/;

function cleanStops(s) {
  const out = (Array.isArray(s) ? s : []).slice(0, 12).map((x) => ({ o: num(x?.o, 0, 1, 0), c: hex(x?.c), a: num(x?.a, 0, 1, 1) }));
  return out.length >= 2 ? out : [{ o: 0, c: "#000000", a: 1 }, { o: 1, c: "#FFFFFF", a: 1 }];
}
function cleanFill(f) {
  if (!f || typeof f !== "object") return null;
  const v = f.v === false ? { v: false } : {};
  if (f.t === "s") return { t: "s", c: hex(f.c, "#D9D9D9"), a: num(f.a, 0, 1, 1), ...v };
  if (f.t === "l" || f.t === "r") return { t: f.t, stops: cleanStops(f.stops), ang: num(f.ang, -360, 360, 90), a: num(f.a, 0, 1, 1), ...v };
  if (f.t === "i") { const src = safeImg(f.src); if (!src || src.startsWith("data:")) return null; return { t: "i", src, fit: pick(f.fit, ["fill", "fit", "crop", "tile"], "fill"), a: num(f.a, 0, 1, 1), cx: num(f.cx, -10, 10, 0), cy: num(f.cy, -10, 10, 0), cs: num(f.cs, 0.05, 20, 1), iw: num(f.iw, 0, 20000, 0), ih: num(f.ih, 0, 20000, 0), ...v }; }
  return null;
}
const cleanStroke = (s) => (!s || typeof s !== "object" ? null : { c: hex(s.c), a: num(s.a, 0, 1, 1), w: num(s.w, 0, 400, 1), al: pick(s.al, ["i", "c", "o"], "i"), ...(s.d ? { d: num(s.d, 0, 400, 0), g: num(s.g, 0, 400, 0) } : {}), ...(s.v === false ? { v: false } : {}) });
const cleanFx = (e) => (!e || typeof e !== "object" || !["ds", "is", "lb", "bb"].includes(e.t) ? null : { t: e.t, x: num(e.x, -2000, 2000, 0), y: num(e.y, -2000, 2000, 4), b: num(e.b, 0, 500, 8), s: num(e.s, -500, 500, 0), c: hex(e.c), a: num(e.a, 0, 1, 0.25), ...(e.v === false ? { v: false } : {}) });
function cleanRun(r) {
  if (!r || typeof r !== "object") return null;
  const o = { s: str(r.s, 20000) };
  if (FONT.test(r.f || "")) o.f = r.f;
  o.w = num(r.w, 100, 900, 400); o.sz = num(r.sz, 1, 2000, 16); o.c = hex(r.c, "#1A1A1A"); o.a = num(r.a, 0, 1, 1);
  if (r.i) o.i = 1; if (r.u) o.u = 1; if (r.st) o.st = 1;
  o.ls = num(r.ls, -50, 200, 0); o.lh = num(r.lh, 0, 10, 0); // lh: 0 means auto (1.2)
  return o;
}
export function cleanNode(n) {
  if (!n || typeof n !== "object" || !okId(n.id) || !TYPES.includes(n.t)) return null;
  const o = { id: n.id, t: n.t, name: str(n.name, 120), x: num(n.x, -1e6, 1e6), y: num(n.y, -1e6, 1e6), w: num(n.w, -1e5, 1e5, 100), h: num(n.h, -1e5, 1e5, 100), z: num(n.z, -1e9, 1e9, 0) };
  if (okId(n.parent)) o.parent = n.parent;
  if (n.rot) o.rot = num(n.rot, -360, 360, 0);
  if (n.op != null && +n.op !== 1) o.op = num(n.op, 0, 1, 1);
  if (n.blend && n.blend !== "normal") o.blend = pick(n.blend, BLENDS, "normal");
  if (n.hide) o.hide = 1; if (n.lock) o.lock = 1; if (n.mask) o.mask = 1;
  o.fills = (Array.isArray(n.fills) ? n.fills : []).slice(0, 10).map(cleanFill).filter(Boolean);
  o.strokes = (Array.isArray(n.strokes) ? n.strokes : []).slice(0, 6).map(cleanStroke).filter(Boolean);
  o.fx = (Array.isArray(n.fx) ? n.fx : []).slice(0, 8).map(cleanFx).filter(Boolean);
  if (Array.isArray(n.r)) o.r = n.r.slice(0, 4).map((v) => num(v, 0, 1e5, 0)); else if (n.r) o.r = num(n.r, 0, 1e5, 0);
  switch (n.t) {
    case "frame": if (n.clip === false) o.clip = false; break;
    case "line": o.ea = pick(n.ea, ["none", "arrow", "dot", "bar"], "none"); o.eb = pick(n.eb, ["none", "arrow", "dot", "bar"], "none"); break;
    case "polygon": o.n = num(n.n, 3, 24, 3); break;
    case "star": o.n = num(n.n, 3, 30, 5); o.ratio = num(n.ratio, 0.05, 0.99, 0.45); break;
    case "text":
      o.runs = (Array.isArray(n.runs) ? n.runs : []).slice(0, 400).map(cleanRun).filter(Boolean);
      o.ta = pick(n.ta, ["left", "center", "right", "justify"], "left"); o.va = pick(n.va, ["top", "middle", "bottom"], "top");
      o.auto = pick(n.auto, ["w", "h", "fixed"], "w"); o.tc = pick(n.tc, ["none", "upper", "lower", "title"], "none");
      break;
    case "bool": o.op2 = pick(n.op2, ["union", "subtract", "intersect", "exclude"], "union"); break;
  }
  return o;
}
const cleanSlides = (s, nodes) => (Array.isArray(s) ? s : []).filter((id) => okId(id) && (!nodes || (nodes[id] && nodes[id].t === "frame"))).slice(0, 300);
const cleanThumb = (t) => (typeof t === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(t) && t.length < 120000 ? t : "");
const statOf = (doc, thumb) => ({ count: Object.keys(doc.nodes || {}).length, updated: doc.updated, rev: doc.rev || 0, thumb: thumb ?? "" });

export const metaOf = (m) => ({ id: m.id, title: m.title || "", order: m.order || 0, created: m.created, updated: m.updated, trashed: m.trashed || 0, count: m.count || 0, thumb: m.thumb || "", share: m.share || "" });
export async function loadIndex(store) { return (await store.get(idxKey, { type: "json" })) ?? []; }
export async function listDesigns(store) {
  const all = await loadIndex(store);
  const stats = await Promise.all(all.map((m) => store.get(statKey(m.id), { type: "json" }).catch(() => null)));
  return all.map((m, i) => (stats[i] ? { ...m, count: stats[i].count, thumb: stats[i].thumb || "", updated: Math.max(m.updated || 0, stats[i].updated || 0) } : m));
}
export async function loadDesign(store, id) { return (await store.get(docKey(id), { type: "json" })) ?? { id, nodes: {}, slides: [], bg: "#E9EBEE", updated: 0, rev: 0 }; }

export async function createDesign(store, b) {
  const all = await loadIndex(store);
  if (all.filter((x) => !x.trashed).length >= MAX_DESIGNS) throw Object.assign(new Error("full"), { code: 400, msg: `You have the most designs allowed (${MAX_DESIGNS})` });
  const id = okId(b.id) && !all.some((x) => x.id === b.id) ? b.id : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
  const now = Date.now();
  const meta = { id, title: str(b.title, 120).trim(), order: Math.min(0, ...all.map((x) => x.order || 0)) - 1, created: now, updated: now, trashed: 0, share: "" };
  const doc = { id, nodes: {}, slides: [], bg: hex(b.bg, "#E9EBEE"), updated: now, rev: 1 };
  for (const n of Array.isArray(b.nodes) ? b.nodes.slice(0, MAX_NODES) : []) { const c = cleanNode(n); if (c) doc.nodes[c.id] = c; }
  doc.slides = cleanSlides(b.slides, doc.nodes);
  await store.setJSON(docKey(id), doc); // the design first, so a save that arrives right away always finds it
  await store.setJSON(statKey(id), statOf(doc, cleanThumb(b.thumb)));
  await saveJSON(store, idxKey, [...all, meta]);
  return { meta: { ...meta, count: Object.keys(doc.nodes).length }, doc };
}

export async function updateMeta(store, id, b) {
  const all = await loadIndex(store), i = all.findIndex((x) => x.id === id); if (i < 0) return null;
  const m = { ...all[i] };
  if ("title" in b) m.title = str(b.title, 120).trim();
  if ("order" in b) m.order = num(b.order, -1e9, 1e9, 0);
  if ("trashed" in b) m.trashed = b.trashed ? Date.now() : 0;
  if (Object.keys(b).some((k) => k !== "order")) m.updated = Date.now();
  all[i] = m; await saveJSON(store, idxKey, all);
  return m;
}
export async function reorder(store, ids) {
  const all = await loadIndex(store), pos = new Map((Array.isArray(ids) ? ids : []).filter(okId).map((id, i) => [id, i]));
  for (const m of all) if (pos.has(m.id)) m.order = pos.get(m.id);
  if (pos.size) await saveJSON(store, idxKey, all);
  return all;
}

// A change from the editor: nodes to add or replace and ids to remove, applied to the latest saved copy, so edits from two
// tabs both survive (the last change to the same node wins). `base` is the revision the editor last saw saved; a read older
// than that is refused ({stale}) and the editor then sends the whole design ({full}).
export async function patchDesign(store, id, p) {
  let doc = await store.get(docKey(id), { type: "json" });
  const base = p.base != null && Number.isFinite(+p.base) ? +p.base : null;
  if (!doc) {
    if (base > 0 && !p.full) return { stale: true, rev: 0 };
    if (!(base > 0) && !(await loadIndex(store)).some((x) => x.id === id)) return null;
    doc = { id, nodes: {}, slides: [], bg: "#E9EBEE", updated: 0, rev: 0 };
  }
  const rev = doc.rev || 0;
  if (base != null && base > rev && !p.full) return { stale: true, rev };
  const prev = doc.nodes || {}, before = Object.keys(prev).length;
  doc.nodes = p.full ? {} : { ...prev };
  for (const n of Array.isArray(p.full ? p.nodes : p.up) ? (p.full ? p.nodes : p.up) : []) { const c = cleanNode(n); if (c) doc.nodes[c.id] = c; }
  if (!p.full) for (const k of Array.isArray(p.del) ? p.del : []) if (okId(k)) delete doc.nodes[k];
  // nothing is left pointing at a parent that is gone: it moves up to the top level instead of disappearing
  for (const n of Object.values(doc.nodes)) if (n.parent && !doc.nodes[n.parent]) delete n.parent;
  if (Object.keys(doc.nodes).length > MAX_NODES) throw Object.assign(new Error("full"), { code: 400, msg: `A design holds at most ${MAX_NODES} layers` });
  if ("slides" in p) doc.slides = cleanSlides(p.slides, doc.nodes); else doc.slides = cleanSlides(doc.slides, doc.nodes);
  if ("bg" in p) doc.bg = hex(p.bg, doc.bg || "#E9EBEE");
  if ("sw" in p) doc.sw = (Array.isArray(p.sw) ? p.sw : []).map((c) => hex(c, "")).filter(Boolean).slice(0, 40); // saved colours
  const after = Object.keys(doc.nodes).length, shrunk = before >= 8 && after < before * 0.5;
  try {
    const hist = (await store.get(histKey(id), { type: "json" })) ?? [];
    if (before && (shrunk || !hist.length || Date.now() - hist[0].ts > HIST_EVERY)) await store.setJSON(histKey(id), [{ ts: Date.now(), nodes: prev, slides: doc.slides, bg: doc.bg }, ...hist].slice(0, HIST_KEEP));
  } catch {}
  doc.updated = Date.now(); doc.rev = Math.max(rev, base || 0) + 1;
  await store.setJSON(docKey(id), doc);
  const old = (await store.get(statKey(id), { type: "json" }).catch(() => null)) || {};
  const stat = statOf(doc, "thumb" in p ? cleanThumb(p.thumb) : old.thumb || "");
  await store.setJSON(statKey(id), stat);
  return { stat, rev: doc.rev, updated: doc.updated };
}

// a private link for one design: view and present only. Switching it off makes the old link stop working at once.
export async function setShare(store, id, on) {
  const all = await loadIndex(store), i = all.findIndex((x) => x.id === id); if (i < 0) return null;
  const m = { ...all[i] };
  if (on && !m.share) {
    const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"; let t = "";
    const rnd = new Uint8Array(28); globalThis.crypto.getRandomValues(rnd); for (const b of rnd) t += a[b % a.length];
    m.share = t; await store.setJSON(shareKey(t), { id, on: true, ts: Date.now() });
  } else if (!on && m.share) {
    await store.setJSON(shareKey(m.share), { id, on: false, ts: Date.now() }); m.share = "";
  }
  all[i] = m; await saveJSON(store, idxKey, all);
  return m;
}
// what someone with the link sees: the slides (or every top-level frame) and what is inside them, nothing else
export async function publicView(store, token) {
  if (!okToken(token)) return null;
  const s = await store.get(shareKey(token), { type: "json" }); if (!s || !s.on || !okId(s.id)) return null;
  const meta = (await loadIndex(store)).find((x) => x.id === s.id); if (!meta || meta.trashed || meta.share !== token) return null;
  const doc = await loadDesign(store, s.id), nodes = doc.nodes || {};
  const tops = Object.values(nodes).filter((n) => n.t === "frame" && !n.parent && !n.hide);
  const slides = (doc.slides || []).filter((id) => nodes[id]).length ? doc.slides.filter((id) => nodes[id]) : tops.sort((a, b) => (Math.abs(a.y - b.y) > 40 ? a.y - b.y : a.x - b.x)).map((n) => n.id);
  const keep = new Set(slides), kids = new Map();
  for (const n of Object.values(nodes)) if (n.parent) (kids.get(n.parent) || kids.set(n.parent, []).get(n.parent)).push(n.id);
  const walk = (id) => { for (const k of kids.get(id) || []) { keep.add(k); walk(k); } };
  slides.forEach(walk);
  const out = {}; for (const id of keep) out[id] = nodes[id];
  return { title: meta.title || "Untitled", slides, nodes: out, updated: doc.updated };
}

export async function purgeDesign(store, id, bk) {
  const all = await loadIndex(store), m = all.find((x) => x.id === id); if (!m) return false;
  const doc = await loadDesign(store, id);
  if (bk) { try { await bk.setJSON(`purged-design-${Date.now()}-${id}`, { kind: "design-purged", ts: Date.now(), meta: m, doc }); } catch {} } // a last safety copy
  if (m.share) await store.setJSON(shareKey(m.share), { id, on: false, ts: Date.now() });
  await saveJSON(store, idxKey, all.filter((x) => x.id !== id));
  await store.delete(docKey(id)); await store.delete(statKey(id)); await store.delete(histKey(id));
  return true;
}
