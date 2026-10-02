// Docs: a private workspace of pages inside pages (like Notion). Each page is its own record plus one small index.
// Pages are private. The owner can "Publish to web" one page (and its address, /docs/<slug>, gets the same SEO as the Journal).
import { cleanBlocks, slugify, safeImg, rid, blocksText, wordCount } from "../../shared/blocks.mjs";
import { saveJSON } from "./safe.mjs";
import { ICONS } from "../../shared/icons.mjs";

const str = (v, n) => String(v ?? "").trim().slice(0, n);
export const GRADS = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"];
const MAX_PAGES = 600, HIST_EVERY = 5 * 60_000, HIST_KEEP = 40;
export const idxKey = "docs-index";
export const pageKey = (id) => `doc-${id}`;
export const histKey = (id) => `doc-hist-${id}`;

export const metaOf = (m) => ({ id: m.id, kind: m.kind === "db" ? "db" : "page", sec: m.sec === "space" ? "space" : "private", role: m.role || "", dbv: m.kind === "db" ? (m.dbv || "table") : undefined, title: m.title, icon: m.icon, parent: m.parent || null, order: m.order || 0, fav: !!m.fav, pub: !!m.pub, slug: m.slug, cover: m.cover || null, desc: m.desc || "", noindex: !!m.noindex, created: m.created, updated: m.updated, trashed: m.trashed || 0, words: m.words || 0 });
export const loadIndex = async (store) => (await store.get(idxKey, { type: "json" })) ?? [];

export function cleanMeta(b, prev = {}, all = []) {
  const o = { ...prev };
  if ("title" in b) o.title = str(b.title, 160);
  if ("icon" in b) o.icon = ICONS[b.icon] ? b.icon : "";
  if ("desc" in b) o.desc = str(b.desc, 200);
  if ("sec" in b) o.sec = b.sec === "space" ? "space" : "private";
  if ("role" in b) o.role = ["tasks", "notes"].includes(b.role) ? b.role : "";
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
  const base = { id, kind: b.kind === "db" ? "db" : "page", sec: "private", role: "", title: "", icon: "", parent: null, order: (Math.max(-1, ...sib.map((x) => x.order || 0)) + 1), fav: false, pub: false, slug: "", cover: null, desc: "", noindex: false, created: now, updated: now, trashed: 0, words: 0 };
  const meta = cleanMeta({ title: b.title ?? "", icon: b.icon ?? "", parent: b.parent || null, cover: b.cover, desc: b.desc, sec: b.sec, role: b.role }, base, all);
  const blocks = cleanBlocks(b.blocks);
  meta.words = wordCount(blocks);
  const db = meta.kind === "db" ? cleanDb(b.db) : undefined; if (db) meta.dbv = db.view;
  await saveJSON(store, idxKey, [...all, meta]);
  await store.setJSON(pageKey(id), { id, blocks, ...(db ? { db } : {}), updated: now });
  return { meta, blocks, db };
}

export async function updatePage(store, id, b) {
  const all = await loadIndex(store), i = all.findIndex((x) => x.id === id);
  if (i < 0) return null;
  const meta = cleanMeta(b, all[i], all);
  let blocks = null;
  if (Array.isArray(b.blocks)) {
    blocks = cleanBlocks(b.blocks); meta.words = wordCount(blocks);
    const cur = await store.get(pageKey(id), { type: "json" });
    // two tabs or two devices: the newer saved text wins, so refuse a save made from an older copy and let the editor keep both
    if (cur && b.base && (cur.updated || 0) > +b.base && !b.force) return { conflict: true, current: { meta: all[i], blocks: cur.blocks || [] } };
    // a rolling history: a snapshot at most every five minutes, the last forty kept. A save that removes most of the
    // text always keeps the version it replaces, whatever the timer says.
    if (cur && cur.blocks?.length) {
      const hist = (await store.get(histKey(id), { type: "json" })) ?? [];
      const was = wordCount(cur.blocks), shrunk = was >= 20 && meta.words < was * 0.4;
      if (!hist.length || shrunk || Date.now() - hist[0].ts > HIST_EVERY) await store.setJSON(histKey(id), [{ ts: Date.now(), title: all[i].title, blocks: cur.blocks }, ...hist].slice(0, HIST_KEEP));
    }
  }
  let db = null;
  if (b.db && typeof b.db === "object" && all[i].kind === "db") {
    db = cleanDb(b.db); meta.dbv = db.view;
    const cur = await store.get(pageKey(id), { type: "json" });
    if (cur && b.base && (cur.updated || 0) > +b.base && !b.force) return { conflict: true, current: { meta: all[i], blocks: cur.blocks || [], db: cur.db || null } };
    if (cur && cur.db && (cur.db.rows || []).length >= 5 && db.rows.length < cur.db.rows.length * 0.4) { // most rows gone at once: keep the old table in the history
      const hist = (await store.get(histKey(id), { type: "json" })) ?? [];
      await store.setJSON(histKey(id), [{ ts: Date.now(), title: all[i].title, blocks: cur.blocks || [], db: cur.db }, ...hist].slice(0, HIST_KEEP));
    }
    blocks = blocks || (cur && cur.blocks) || [];
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
  if (db) await store.setJSON(pageKey(id), { id, blocks: blocks || [], db, updated: meta.updated });
  else if (blocks) { const keep = all[i].kind === "db" ? (await store.get(pageKey(id), { type: "json" }))?.db : null; await store.setJSON(pageKey(id), { id, blocks, ...(keep ? { db: keep } : {}), updated: meta.updated }); }
  return { meta, blocks, db, index: all };
}

export async function purge(store, id, bk) {
  const all = await loadIndex(store), kids = new Set([id]); let grew = true;
  while (grew) { grew = false; for (const x of all) if (x.parent && kids.has(x.parent) && !kids.has(x.id)) { kids.add(x.id); grew = true; } }
  if (!all.some((x) => kids.has(x.id))) return false;
  if (bk) { // a last safety copy of what is being deleted for good, kept in the separate backup store
    try {
      const pages = {}; for (const k of kids) pages[k] = { meta: all.find((x) => x.id === k), page: await store.get(pageKey(k), { type: "json" }) };
      await bk.setJSON(`purged-${Date.now()}-${id}`, { kind: "docs-purged", ts: Date.now(), pages });
    } catch {}
  }
  await saveJSON(store, idxKey, all.filter((x) => !kids.has(x.id)));
  for (const k of kids) { await store.delete(pageKey(k)); await store.delete(histKey(k)); }
  return true;
}

// What visitors may see: published pages that are not in the bin.
export const publicMetas = (all) => all.filter((m) => m.pub && !m.trashed).map(metaOf);
export const textOf = (blocks) => blocksText(blocks);

/* ---------- databases: a table of rows with typed columns, shown as a table, a board or a calendar ---------- */
const COLT = ["title", "text", "number", "select", "multi", "status", "date", "check", "url"];
const OPTC = ["grey", "blue", "green", "yellow", "orange", "red", "purple", "pink"];
const VIEWS = ["table", "board", "calendar", "list"];
const sid = (v) => String(v ?? "").replace(/[^\w-]/g, "").slice(0, 14);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function cleanDb(d) {
  const seen = new Set();
  let cols = (Array.isArray(d?.cols) ? d.cols : []).slice(0, 30).map((c) => {
    let id = sid(c?.id) || rid().slice(0, 8); while (seen.has(id)) id = rid().slice(0, 8); seen.add(id);
    const type = COLT.includes(c?.type) ? c.type : "text", o = { id, name: str(c?.name, 60), type };
    if (["select", "multi", "status"].includes(type)) { const os = new Set(); o.opts = (Array.isArray(c.opts) ? c.opts : []).slice(0, 40).map((x) => { let oid = sid(x?.id) || rid().slice(0, 6); while (os.has(oid)) oid = rid().slice(0, 6); os.add(oid); return { id: oid, name: str(x?.name, 40), color: OPTC.includes(x?.color) ? x.color : "grey" }; }).filter((x) => x.name); }
    const w = Math.round(+c?.w || 0); if (w >= 80 && w <= 640) o.w = w;
    return o;
  });
  const t = cols.filter((c) => c.type === "title");
  if (!t.length) cols.unshift({ id: seen.has("title") ? "t" + rid().slice(0, 5) : "title", name: "Name", type: "title" });
  else if (t.length > 1) cols = cols.map((c, i) => (c.type === "title" && c !== t[0] ? { ...c, type: "text" } : c));
  const ti = cols.findIndex((c) => c.type === "title"); if (ti > 0) cols.unshift(cols.splice(ti, 1)[0]);
  const byId = Object.fromEntries(cols.map((c) => [c.id, c])), rseen = new Set();
  const cell = (c, v) => {
    if (v == null || v === "") return undefined;
    switch (c.type) {
      case "title": case "text": return str(v, 2000) || undefined;
      case "number": { const n = +v; return Number.isFinite(n) ? n : undefined; }
      case "select": case "status": return c.opts.some((o) => o.id === v) ? v : undefined;
      case "multi": { const a = (Array.isArray(v) ? v : []).filter((x) => c.opts.some((o) => o.id === x)).slice(0, 20); return a.length ? a : undefined; }
      case "date": return DAY.test(String(v)) ? String(v) : undefined;
      case "check": return v === true ? true : undefined;
      case "url": { const u = str(v, 500); return /^(https?:\/\/|mailto:)/i.test(u) ? u : undefined; }
    }
  };
  const rows = (Array.isArray(d?.rows) ? d.rows : []).slice(0, 3000).map((r) => {
    let id = sid(r?.id) || rid().slice(0, 10); while (rseen.has(id)) id = rid().slice(0, 10); rseen.add(id);
    const c = {}; for (const [k, v] of Object.entries(r?.c || {})) { const col = byId[k]; if (!col) continue; const x = cell(col, v); if (x !== undefined) c[k] = x; }
    const o = { id, c }; const note = str(r?.note, 20000); if (note) o.note = note;
    o.created = +r?.created || Date.now(); o.updated = +r?.updated || o.created; return o;
  });
  const out = { cols, rows, view: VIEWS.includes(d?.view) ? d.view : "table" };
  if (d?.group && byId[d.group] && ["select", "status"].includes(byId[d.group].type)) out.group = d.group;
  if (d?.dateCol && byId[d.dateCol] && byId[d.dateCol].type === "date") out.dateCol = d.dateCol;
  if (d?.sort && byId[d.sort.col]) out.sort = { col: d.sort.col, dir: d.sort.dir === "desc" ? "desc" : "asc" };
  return out;
}
/* every dated row in every database, for the calendar and "Today" on the home page */
export async function agenda(store, all) {
  const out = [];
  for (const m of all.filter((x) => x.kind === "db" && !x.trashed)) {
    const pg = await store.get(pageKey(m.id), { type: "json" }); const d = pg && pg.db; if (!d) continue;
    const dc = (d.dateCol && d.cols.find((c) => c.id === d.dateCol)) || d.cols.find((c) => c.type === "date"); if (!dc) continue;
    const tc = d.cols.find((c) => c.type === "title"), st = d.cols.find((c) => c.type === "status"), ck = d.cols.find((c) => c.type === "check");
    const doneIds = st ? st.opts.filter((o) => /done|complete|finished/i.test(o.name)).map((o) => o.id) : [];
    for (const r of d.rows) { const day = r.c[dc.id]; if (!day) continue; out.push({ db: m.id, row: r.id, title: (tc && r.c[tc.id]) || "", date: day, done: !!((st && doneIds.includes(r.c[st.id])) || (ck && r.c[ck.id])) }); }
  }
  return out.slice(0, 2000);
}
