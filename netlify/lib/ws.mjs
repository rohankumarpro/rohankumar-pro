// Workspace: pages that live on their own (not on a board) and databases (like Notion's), owner only.
// New keys only; boards, their pages and everything else are untouched:
//   ws-pages            [meta]   pages of their own: {id, title, icon, cover, parent, order, fav, trashed, created, updated, snip}
//   ws-dbs              [meta]   the databases: {id, title, icon, cover, fav, trashed, order, role, created, updated, count}
//   wsdb-<id>           {props, rows, views, trash, rev, updated}   one database
//   wsdb-hist-<id>      [{ts, doc}]   safety copies of a database (every 10 minutes and before big removals)
// The writing inside a page or a database row is kept like any board page: bpage-<id> (see boards.mjs), so it has the
// same history, conflict checks and live sync.
// Nothing is ever deleted for good here: pages and databases go to the bin (trashed), removed rows are kept in `trash`.
import { safeImg, safeUrl } from "../../shared/blocks.mjs";
import { ICONS } from "../../shared/icons.mjs";

export const PAGES = "ws-pages", DBS = "ws-dbs";
export const dbKey = (id) => `wsdb-${id}`, dbHistKey = (id) => `wsdb-hist-${id}`;
export const okId = (v) => typeof v === "string" && /^[\w-]{4,32}$/.test(v);
const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const num = (v) => { const n = +v; return Number.isFinite(n) ? n : null; };
const HIST_EVERY = 10 * 60_000, HIST_KEEP = 20, MAX_ROWS = 5000, MAX_PROPS = 60, MAX_PAGES = 2000, MAX_DBS = 200;

export const PROP_TYPES = ["text", "number", "select", "multi", "status", "date", "checkbox", "url", "email", "phone", "relation", "created", "edited"];
export const OPT_COLORS = ["grey", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
const COVER_KEYS = Array.from({ length: 16 }, (_, i) => "m" + (i + 1));

function cleanCover(c) {
  if (!c) return null;
  if (COVER_KEYS.includes(c.k)) return { k: c.k, y: num(c.y) ?? 50 };
  const src = safeImg(c.src || ""); return src ? { src, y: Math.max(0, Math.min(100, num(c.y) ?? 50)) } : null;
}
const cleanIcon = (v) => (ICONS[v] ? v : "");

/* ---------- pages ---------- */
export function cleanPageMeta(b, prev = {}) {
  const o = { ...prev };
  if ("title" in b) o.title = str(b.title, 200);
  if ("icon" in b) o.icon = cleanIcon(b.icon);
  if ("cover" in b) o.cover = cleanCover(b.cover);
  if ("parent" in b) o.parent = b.parent && okId(b.parent) && b.parent !== o.id ? b.parent : null;
  if ("order" in b) o.order = num(b.order) ?? 0;
  if ("fav" in b) o.fav = !!b.fav;
  if ("trashed" in b) o.trashed = !!b.trashed;
  if ("snip" in b) o.snip = str(b.snip, 320);
  if ("full" in b) o.full = !!b.full;
  o.updated = Date.now();
  return o;
}

/* ---------- databases ---------- */
function cleanOpts(list) {
  const seen = new Set();
  return (Array.isArray(list) ? list : []).slice(0, 100).map((o) => ({ id: okId(o.id) ? o.id : rid(), name: str(o.name, 60).trim(), color: OPT_COLORS.includes(o.color) ? o.color : "grey", ...(o.group ? { group: ["todo", "doing", "done"].includes(o.group) ? o.group : "todo" } : {}) }))
    .filter((o) => o.name && !seen.has(o.id) && seen.add(o.id));
}
export function cleanProp(p) {
  if (!p || !PROP_TYPES.includes(p.type)) return null;
  const o = { id: okId(p.id) ? p.id : rid(), name: str(p.name, 60).trim() || "Property", type: p.type };
  if (["select", "multi", "status"].includes(p.type)) o.opts = cleanOpts(p.opts);
  if (p.type === "number") o.fmt = ["plain", "comma", "percent", "inr", "usd", "eur", "gbp"].includes(p.fmt) ? p.fmt : "plain";
  if (p.type === "relation") o.db = okId(p.db) ? p.db : "";
  if (p.type === "date") o.time = !!p.time;
  if (p.w) o.w = Math.max(80, Math.min(600, num(p.w) || 180));
  if (p.hide) o.hide = true;
  return o;
}
function cleanValue(prop, v) {
  if (v == null || v === "") return undefined;
  switch (prop.type) {
    case "text": return str(v, 4000);
    case "number": return num(v) ?? undefined;
    case "select": case "status": return (prop.opts || []).some((o) => o.id === v) ? v : undefined;
    case "multi": { const ids = new Set((prop.opts || []).map((o) => o.id)); const out = (Array.isArray(v) ? v : []).filter((x) => ids.has(x)); return out.length ? [...new Set(out)] : undefined; }
    case "date": { // "YYYY-MM-DD", "YYYY-MM-DDTHH:MM", or {s, e} for a range
      const one = (x) => (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(String(x || "")) ? String(x) : "");
      if (typeof v === "object") { const s = one(v.s), e = one(v.e); return s ? (e && e > s ? { s, e } : s) : undefined; }
      return one(v) || undefined;
    }
    case "checkbox": return v ? true : undefined;
    case "url": return safeUrl(String(v)) ? str(v, 500) : undefined;
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v)) ? str(v, 200) : undefined;
    case "phone": return str(v, 40).replace(/[^\d+()\-.\s]/g, "") || undefined;
    case "relation": return (Array.isArray(v) ? v : []).filter(okId).slice(0, 100);
    default: return undefined;
  }
}
export function cleanRow(r, props, prev) {
  const o = prev ? { ...prev, v: { ...(prev.v || {}) } } : { id: okId(r.id) ? r.id : rid(), v: {}, created: Date.now() };
  if ("title" in r) o.title = str(r.title, 300);
  if ("icon" in r) o.icon = cleanIcon(r.icon);
  if ("cover" in r) o.cover = cleanCover(r.cover);
  if ("order" in r) o.order = num(r.order) ?? 0;
  if ("snip" in r) o.snip = str(r.snip, 320);
  if (r.v && typeof r.v === "object") for (const [k, val] of Object.entries(r.v)) {
    const p = props.find((x) => x.id === k); if (!p || p.type === "created" || p.type === "edited") continue;
    const c = cleanValue(p, val); if (c === undefined || (Array.isArray(c) && !c.length)) delete o.v[k]; else o.v[k] = c;
  }
  o.updated = Date.now();
  return o;
}
const VIEW_TYPES = ["table", "board", "calendar", "gallery", "list"];
export function cleanView(v, props) {
  const has = (id) => props.some((p) => p.id === id);
  const o = { id: okId(v.id) ? v.id : rid(), name: str(v.name, 40).trim() || "View", type: VIEW_TYPES.includes(v.type) ? v.type : "table" };
  o.filter = (Array.isArray(v.filter) ? v.filter : []).filter((f) => f && (f.p === "title" || has(f.p))).slice(0, 12).map((f) => ({ p: f.p, op: str(f.op, 12), val: typeof f.val === "object" ? f.val : str(f.val, 200) }));
  o.sort = (Array.isArray(v.sort) ? v.sort : []).filter((s) => s && (s.p === "title" || s.p === "created" || s.p === "updated" || has(s.p))).slice(0, 4).map((s) => ({ p: s.p, d: s.d === "desc" ? "desc" : "asc" }));
  if (v.group && has(v.group)) o.group = v.group;
  if (v.date && has(v.date)) o.date = v.date;
  if (Array.isArray(v.show)) o.show = v.show.filter((x) => has(x) || x === "__none").slice(0, 30);
  if (v.tw) o.tw = Math.max(120, Math.min(800, num(v.tw) || 280));
  if (v.month) o.month = /^\d{4}-\d{2}$/.test(v.month) ? v.month : undefined;
  if (Array.isArray(v.order)) o.order = v.order.filter((x) => x === "title" || has(x)).slice(0, MAX_PROPS + 1);
  if (v.cover) o.cover = ["page", "none"].includes(v.cover) ? v.cover : "page";
  if (v.size) o.size = ["s", "m", "l"].includes(v.size) ? v.size : "m";
  if (Array.isArray(v.collapsed)) o.collapsed = v.collapsed.map((x) => str(x, 40)).slice(0, 40);
  if (v.wrap) o.wrap = true;
  return o;
}

/* ---------- templates ---------- */
const P = (name, type, extra = {}) => ({ id: rid(), name, type, ...extra });
const O = (name, color, group) => ({ id: rid(), name, color, ...(group ? { group } : {}) });
export const TEMPLATES = {
  blank: { title: "Untitled database", icon: "table", make() { const tags = P("Tags", "multi", { opts: [] }); return { props: [tags, P("Created", "created")], views: [{ id: rid(), name: "Table", type: "table" }] }; } },
  tasks: { title: "Tasks", icon: "checkbox", role: "tasks", make() {
    const status = P("Status", "status", { opts: [O("To do", "grey", "todo"), O("Doing", "blue", "doing"), O("Done", "green", "done")] });
    const due = P("Due", "date"), pri = P("Priority", "select", { opts: [O("High", "red"), O("Medium", "yellow"), O("Low", "grey")] }), area = P("Area", "select", { opts: [O("Work", "blue"), O("Content", "purple"), O("Personal", "green")] });
    return { props: [status, due, pri, area], views: [{ id: rid(), name: "Board", type: "board", group: status.id }, { id: rid(), name: "All tasks", type: "table", sort: [{ p: due.id, d: "asc" }] }, { id: rid(), name: "Calendar", type: "calendar", date: due.id }] };
  } },
  projects: { title: "Projects", icon: "rocket", make() {
    const status = P("Status", "status", { opts: [O("Planned", "grey", "todo"), O("In progress", "blue", "doing"), O("Done", "green", "done")] });
    return { props: [status, P("Client", "text"), P("Start", "date"), P("Deadline", "date"), P("Budget", "number", { fmt: "inr" }), P("Link", "url")], views: [{ id: rid(), name: "Board", type: "board", group: status.id }, { id: rid(), name: "Table", type: "table" }] };
  } },
  reading: { title: "Library", icon: "bookmark", role: "reading", make() {
    const st = P("Status", "status", { opts: [O("To read", "grey", "todo"), O("Reading", "blue", "doing"), O("Finished", "green", "done")] });
    return { props: [P("Author", "text"), st, P("Rating", "select", { opts: [O("5", "green"), O("4", "blue"), O("3", "yellow"), O("2", "orange"), O("1", "red")] }), P("Progress", "number", { fmt: "percent" }), P("Pages", "number"), P("Started", "date"), P("Finished", "date"), P("Link", "url")], views: [{ id: rid(), name: "Shelf", type: "gallery", cover: "page" }, { id: rid(), name: "By status", type: "board", group: st.id }] };
  } },
  subs: { title: "Subscriptions", icon: "wallet", role: "subs", make() {
    const st = P("Status", "status", { opts: [O("Trial", "yellow", "todo"), O("Active", "green", "doing"), O("Cancelled", "grey", "done")] });
    const cyc = P("Cycle", "select", { opts: [O("Monthly", "blue"), O("Yearly", "purple"), O("Quarterly", "orange"), O("Half-yearly", "pink"), O("Weekly", "green")] });
    const cur = P("Currency", "select", { opts: [O("INR", "orange"), O("USD", "green"), O("EUR", "blue"), O("GBP", "purple")] });
    const next = P("Next charge", "date"), cat = P("Category", "select", { opts: [O("Design tools", "purple"), O("Software", "blue"), O("Entertainment", "red"), O("Cloud and storage", "grey"), O("Learning", "green"), O("Utilities", "brown")] });
    return { props: [P("Amount", "number"), cur, cyc, next, st, cat, P("Paid with", "text"), P("Manage or cancel", "url"), P("Found in", "text")], views: [{ id: rid(), name: "All", type: "table", sort: [{ p: next.id, d: "asc" }] }, { id: rid(), name: "Renewals", type: "calendar", date: next.id }] };
  } },
  content: { title: "Content calendar", icon: "video", role: "content", make() {
    const st = P("Stage", "status", { opts: [O("Idea", "grey", "todo"), O("Scripting", "yellow", "doing"), O("Filming", "orange", "doing"), O("Editing", "purple", "doing"), O("Published", "green", "done")] });
    const pub = P("Publish", "date");
    return { props: [st, P("Platform", "multi", { opts: [O("YouTube", "red"), O("Instagram", "pink"), O("LinkedIn", "blue")] }), pub, P("Link", "url")], views: [{ id: rid(), name: "Pipeline", type: "board", group: st.id }, { id: rid(), name: "Calendar", type: "calendar", date: pub.id }] };
  } },
};

/* ---------- reading and writing ---------- */
export const loadList = async (store, key) => (await store.get(key, { type: "json" })) ?? [];
export async function loadDb(store, id) { return await store.get(dbKey(id), { type: "json" }); }

async function keepCopy(store, id, doc, force) {
  const hist = (await store.get(dbHistKey(id), { type: "json" })) ?? [];
  if (!force && hist.length && Date.now() - hist[0].ts < HIST_EVERY) return;
  await store.setJSON(dbHistKey(id), [{ ts: Date.now(), doc }, ...hist].slice(0, HIST_KEEP));
}

export async function createPage(store, b) {
  const all = await loadList(store, PAGES);
  if (all.length >= MAX_PAGES) return null;
  const m = cleanPageMeta({ title: "", icon: "", cover: null, parent: null, order: Date.now(), ...b }, { id: rid(), created: Date.now() });
  await store.setJSON(PAGES, [m, ...all]);
  return m;
}
export async function updatePage(store, id, b) {
  const all = await loadList(store, PAGES), i = all.findIndex((p) => p.id === id); if (i < 0) return null;
  all[i] = cleanPageMeta(b, all[i]); await store.setJSON(PAGES, all); return all[i];
}

export async function createDb(store, b) {
  const list = await loadList(store, DBS);
  if (list.length >= MAX_DBS) return null;
  const t = TEMPLATES[b.tpl] || TEMPLATES.blank, made = t.make(), id = rid();
  const props = made.props.map(cleanProp).filter(Boolean), views = made.views.map((v) => cleanView(v, props));
  const doc = { id, props, rows: {}, views, trash: [], rev: 1, updated: Date.now() };
  const meta = { id, title: str(b.title, 120) || t.title, icon: cleanIcon(b.icon) || t.icon, cover: cleanCover(b.cover), fav: false, trashed: false, order: Date.now(), role: t.role || "", created: Date.now(), updated: Date.now(), count: 0, parent: b.parent && okId(b.parent) ? b.parent : null };
  await store.setJSON(dbKey(id), doc);
  await store.setJSON(DBS, [meta, ...list]);
  return { meta, doc };
}
export async function updateDbMeta(store, id, b) {
  const list = await loadList(store, DBS), i = list.findIndex((d) => d.id === id); if (i < 0) return null;
  const o = { ...list[i] };
  if ("title" in b) o.title = str(b.title, 120);
  if ("icon" in b) o.icon = cleanIcon(b.icon);
  if ("cover" in b) o.cover = cleanCover(b.cover);
  if ("fav" in b) o.fav = !!b.fav;
  if ("trashed" in b) o.trashed = !!b.trashed;
  if ("order" in b) o.order = num(b.order) ?? 0;
  if ("parent" in b) o.parent = b.parent && okId(b.parent) ? b.parent : null;
  if ("desc" in b) o.desc = str(b.desc, 300);
  o.updated = Date.now(); list[i] = o; await store.setJSON(DBS, list); return o;
}

// a list of changes, applied in order onto the newest copy (row by row, so two devices editing different rows never clash)
export async function applyOps(store, id, ops) {
  const doc = await loadDb(store, id); if (!doc) return null;
  const before = JSON.stringify(doc);
  let big = false;
  for (const op of (Array.isArray(ops) ? ops : []).slice(0, 500)) {
    if (!op || typeof op !== "object") continue;
    if (op.op === "row" && op.row && (okId(op.row.id) || !op.row.id)) {
      const prev = op.row.id && doc.rows[op.row.id];
      if (!prev && Object.keys(doc.rows).length >= MAX_ROWS) continue;
      const r = cleanRow(op.row, doc.props, prev); doc.rows[r.id] = r;
    } else if (op.op === "delrow" && doc.rows[op.id]) {
      doc.trash = [{ ...doc.rows[op.id], gone: Date.now() }, ...(doc.trash || [])].slice(0, 300); delete doc.rows[op.id]; big = true;
    } else if (op.op === "restore") {
      const i = (doc.trash || []).findIndex((r) => r.id === op.id); if (i >= 0) { const r = { ...doc.trash[i] }; delete r.gone; doc.rows[r.id] = r; doc.trash.splice(i, 1); }
    } else if (op.op === "prop") {
      const p = cleanProp(op.prop); if (!p) continue;
      const i = doc.props.findIndex((x) => x.id === p.id);
      if (i >= 0) {
        const old = doc.props[i];
        // a property that changes kind keeps what still makes sense (text stays text; options carry over between select kinds)
        if (old.type !== p.type) { big = true; for (const r of Object.values(doc.rows)) { if (r.v[p.id] === undefined) continue; const c = cleanValue(p, convertValue(old, p, r.v[p.id])); if (c === undefined) delete r.v[p.id]; else r.v[p.id] = c; } }
        else if (p.opts) { const ids = new Set(p.opts.map((o) => o.id)); for (const r of Object.values(doc.rows)) { const v = r.v[p.id]; if (Array.isArray(v)) { const n = v.filter((x) => ids.has(x)); if (n.length) r.v[p.id] = n; else delete r.v[p.id]; } else if (v && !ids.has(v)) delete r.v[p.id]; } }
        doc.props[i] = p;
      } else if (doc.props.length < MAX_PROPS) doc.props.push(p);
    } else if (op.op === "delprop") {
      const i = doc.props.findIndex((x) => x.id === op.id); if (i < 0) continue;
      big = true; doc.props.splice(i, 1);
      // the values stay in the rows' history copy; views forget the property
      for (const r of Object.values(doc.rows)) delete r.v[op.id];
      doc.views = doc.views.map((v) => cleanView(v, doc.props));
    } else if (op.op === "porder" && Array.isArray(op.ids)) {
      const pos = new Map(op.ids.map((x, i) => [x, i])); doc.props.sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999));
    } else if (op.op === "view" && op.view) {
      const v = cleanView(op.view, doc.props), i = doc.views.findIndex((x) => x.id === v.id);
      if (i >= 0) doc.views[i] = v; else if (doc.views.length < 20) doc.views.push(v);
    } else if (op.op === "delview") {
      if (doc.views.length > 1) doc.views = doc.views.filter((v) => v.id !== op.id);
    } else if (op.op === "vorder" && Array.isArray(op.ids)) {
      const pos = new Map(op.ids.map((x, i) => [x, i])); doc.views.sort((a, b) => (pos.get(a.id) ?? 99) - (pos.get(b.id) ?? 99));
    }
  }
  if (JSON.stringify(doc) === before) return { doc, same: true };
  await keepCopy(store, id, JSON.parse(before), big);
  doc.rev = (doc.rev || 0) + 1; doc.updated = Date.now();
  await store.setJSON(dbKey(id), doc);
  const list = await loadList(store, DBS), i = list.findIndex((d) => d.id === id);
  if (i >= 0) { list[i] = { ...list[i], count: Object.keys(doc.rows).length, updated: doc.updated }; await store.setJSON(DBS, list); }
  return { doc };
}
function convertValue(from, to, v) {
  const name = (id) => (from.opts || []).find((o) => o.id === id)?.name;
  const optBy = (n) => (to.opts || []).find((o) => o.name.toLowerCase() === String(n || "").toLowerCase())?.id;
  if (["select", "status", "multi"].includes(from.type) && ["select", "status"].includes(to.type)) return optBy(name(Array.isArray(v) ? v[0] : v));
  if (["select", "status"].includes(from.type) && to.type === "multi") { const x = optBy(name(v)); return x ? [x] : undefined; }
  if (to.type === "text") return Array.isArray(v) ? v.map(name).filter(Boolean).join(", ") : name(v) || (typeof v === "object" ? v.s : String(v));
  if (to.type === "number") return num(v);
  if (to.type === "checkbox") return !!v;
  return v;
}
