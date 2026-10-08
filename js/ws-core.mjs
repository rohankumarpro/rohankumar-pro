// Workspace data on this device: the list of pages and databases, open databases, and saving changes.
// Every change is applied here first (so the screen answers at once) and sent to /api/ws in small batches.
// Other apps (the Planner, Tasks, the Library) read databases through this same module.
import { api, toast } from "/js/lib.mjs";

const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
export const rid = () => Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 8);

/* ---------- property kinds ---------- */
export const TYPES = {
  text: { name: "Text", ico: "text" }, number: { name: "Number", ico: "hash" }, select: { name: "Select", ico: "select" }, multi: { name: "Multi-select", ico: "list" },
  status: { name: "Status", ico: "status" }, date: { name: "Date", ico: "calendar" }, checkbox: { name: "Checkbox", ico: "checkbox" }, url: { name: "Link", ico: "link" },
  email: { name: "Email", ico: "mail" }, phone: { name: "Phone", ico: "phone" }, relation: { name: "Relation", ico: "swap" }, created: { name: "Created time", ico: "clock" }, edited: { name: "Edited time", ico: "history" },
};
export const OPT_COLORS = ["grey", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"];
export const ICO = { // the few drawn icons the workspace needs beyond the shared set
  hash: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>', select: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 10.5 3.5 3.5 3.5-3.5"/>',
  status: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="3.2 2.4"/><path d="M12 7.5a4.5 4.5 0 0 1 0 9z" fill="currentColor" stroke="none"/>',
  board: '<rect x="3.5" y="4" width="5" height="16" rx="1.6"/><rect x="9.5" y="4" width="5" height="11" rx="1.6"/><rect x="15.5" y="4" width="5" height="13.5" rx="1.6"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>', sort: '<path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5"/>', db: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 9.5h17M9.5 9.5V20"/>',
  props: '<path d="M4 7h10M4 12h16M4 17h7"/><circle cx="17.5" cy="7" r="2"/><circle cx="14.5" cy="17" r="2"/>',
};
export const fmtNum = (n, f) => {
  if (n == null || n === "") return "";
  const c = { inr: "INR", usd: "USD", eur: "EUR", gbp: "GBP" }[f];
  try { if (c) return new Intl.NumberFormat(c === "INR" ? "en-IN" : undefined, { style: "currency", currency: c, maximumFractionDigits: 2 }).format(n); if (f === "percent") return n + "%"; if (f === "comma") return new Intl.NumberFormat().format(n); } catch {}
  return String(n);
};
export const today = () => { const d = new Date(); return ymd(d); };
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const parseDay = (s) => { const [y, m, d] = String(s).slice(0, 10).split("-").map(Number); return new Date(y, m - 1, d); };
export const dateOf = (v) => (v && typeof v === "object" ? v.s : v) || "";
export function fmtDate(v, opt = {}) {
  const one = (s) => {
    if (!s) return ""; const d = parseDay(s), t = String(s).slice(11, 16), now = new Date();
    const diff = Math.round((parseDay(ymd(d)) - parseDay(ymd(now))) / 864e5);
    const rel = opt.rel && (diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff === -1 ? "Yesterday" : "");
    const s1 = rel || d.toLocaleDateString([], { day: "numeric", month: "short", ...(d.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) });
    return t ? `${s1}, ${t}` : s1;
  };
  if (v && typeof v === "object") return `${one(v.s)} → ${one(v.e)}`;
  return one(v);
}

/* ---------- the workspace list ---------- */
const listeners = new Set();
export const WS = {
  pages: ls.get("wsPages", []), dbs: ls.get("wsDbs", []), loaded: false,
  on(f) { listeners.add(f); return () => listeners.delete(f); },
  emit(what) { listeners.forEach((f) => { try { f(what); } catch (e) { console.error(e); } }); },
  async load() {
    const r = await api("/api/ws"); if (!r.ok) return false;
    WS.pages = r.data.pages || []; WS.dbs = r.data.dbs || []; WS.loaded = true;
    ls.set("wsPages", WS.pages); ls.set("wsDbs", WS.dbs); WS.emit("list"); return true;
  },
  page: (id) => WS.pages.find((p) => p.id === id),
  db: (id) => WS.dbs.find((d) => d.id === id),
  dbByRole: (role) => WS.dbs.find((d) => d.role === role && !d.trashed),
  async newPage(b = {}) { const r = await api("/api/ws?a=page", { method: "POST", body: b }); if (!r.ok) { toast(r.data.error || "Could not make the page"); return null; } WS.pages.unshift(r.data.page); ls.set("wsPages", WS.pages); WS.emit("list"); return r.data.page; },
  async setPage(id, b) {
    const p = WS.page(id); if (p) { Object.assign(p, b, { updated: Date.now() }); ls.set("wsPages", WS.pages); WS.emit("list"); }
    const r = await api("/api/ws?a=page&id=" + id, { method: "PUT", body: b }); if (r.ok && p) Object.assign(p, r.data.page); else if (!r.ok) toast("Could not save the page details");
  },
  async newDb(b = {}) { const r = await api("/api/ws?a=db", { method: "POST", body: b }); if (!r.ok) { toast(r.data.error || "Could not make the database"); return null; } WS.dbs.unshift(r.data.meta); ls.set("wsDbs", WS.dbs); DB.put(r.data.meta.id, r.data.doc); WS.emit("list"); return r.data.meta; },
  async setDb(id, b) {
    const d = WS.db(id); if (d) { Object.assign(d, b, { updated: Date.now() }); ls.set("wsDbs", WS.dbs); WS.emit("list"); }
    const r = await api("/api/ws?a=db&id=" + id, { method: "PUT", body: b }); if (!r.ok) toast("Could not save the database details");
  },
};

/* ---------- databases ---------- */
const docs = new Map(); // id -> {doc, pending:[], timer, saving}
const dbListeners = new Map();
export const DB = {
  get: (id) => docs.get(id)?.doc || null,
  put(id, doc) { const e = docs.get(id) || { pending: [] }; e.doc = doc; docs.set(id, e); ls.set("wsDb:" + id, doc); DB.emit(id); },
  on(id, f) { if (!dbListeners.has(id)) dbListeners.set(id, new Set()); dbListeners.get(id).add(f); return () => dbListeners.get(id)?.delete(f); },
  emit(id) { (dbListeners.get(id) || []).forEach((f) => { try { f(); } catch (e) { console.error(e); } }); },
  async open(id, { fresh } = {}) {
    let e = docs.get(id);
    if (!e) { const cached = ls.get("wsDb:" + id, null); if (cached) { DB.put(id, cached); e = docs.get(id); } }
    if (e && e.doc && !fresh) { DB.sync(id); return e.doc; }
    const r = await api("/api/ws?db=" + id); if (!r.ok) return e?.doc || null;
    DB.put(id, r.data.doc); return r.data.doc;
  },
  // another device saved: take its copy when nothing is waiting to be sent from here
  async sync(id) {
    const e = docs.get(id); if (!e || e.pending.length || e.saving) return;
    const r = await api(`/api/ws?db=${id}&rev=${e.doc.rev || 0}`);
    if (r.ok && !r.data.same && r.data.doc && !e.pending.length && !e.saving) DB.put(id, r.data.doc);
  },
  // change rows, properties or views: applied here at once, sent soon after
  ops(id, ops) {
    const e = docs.get(id); if (!e || !e.doc) return;
    for (const op of ops) applyLocal(e.doc, op);
    e.pending.push(...ops); ls.set("wsDb:" + id, e.doc); DB.emit(id);
    clearTimeout(e.timer); e.timer = setTimeout(() => DB.flush(id), 450);
  },
  async flush(id) {
    const e = docs.get(id); if (!e || !e.pending.length || e.saving) return;
    e.saving = true; const ops = e.pending.splice(0);
    const r = await api(`/api/ws?db=${id}&a=ops`, { method: "POST", body: { ops } });
    e.saving = false;
    if (!r.ok) { e.pending.unshift(...ops); toast(r.status === 0 ? "Offline. Changes are kept here and saved when you're back." : "Could not save. Trying again…"); clearTimeout(e.timer); e.timer = setTimeout(() => DB.flush(id), 4000); return; }
    e.doc.rev = r.data.rev; ls.set("wsDb:" + id, e.doc);
    const m = WS.db(id); if (m) { m.count = Object.keys(e.doc.rows).length; m.updated = Date.now(); ls.set("wsDbs", WS.dbs); }
    if (e.pending.length) DB.flush(id);
  },
  flushAll() { for (const id of docs.keys()) DB.flush(id); },
  newRow(id, row = {}) { const r = { id: rid(), title: "", v: {}, created: Date.now(), updated: Date.now(), ...row }; DB.ops(id, [{ op: "row", row: r }]); return r; },
};
function applyLocal(doc, op) {
  if (op.op === "row") { const prev = doc.rows[op.row.id]; const r = prev ? { ...prev, ...op.row, v: { ...(prev.v || {}), ...(op.row.v || {}) } } : { created: Date.now(), v: {}, ...op.row }; for (const k of Object.keys(r.v)) if (r.v[k] == null || r.v[k] === "" || (Array.isArray(r.v[k]) && !r.v[k].length)) delete r.v[k]; r.updated = Date.now(); doc.rows[r.id] = r; }
  else if (op.op === "delrow") { if (doc.rows[op.id]) { doc.trash = [{ ...doc.rows[op.id], gone: Date.now() }, ...(doc.trash || [])]; delete doc.rows[op.id]; } }
  else if (op.op === "restore") { const i = (doc.trash || []).findIndex((r) => r.id === op.id); if (i >= 0) { const r = { ...doc.trash[i] }; delete r.gone; doc.rows[r.id] = r; doc.trash.splice(i, 1); } }
  else if (op.op === "prop") { const i = doc.props.findIndex((p) => p.id === op.prop.id); if (i >= 0) doc.props[i] = { ...op.prop }; else doc.props.push({ ...op.prop }); }
  else if (op.op === "delprop") { doc.props = doc.props.filter((p) => p.id !== op.id); for (const r of Object.values(doc.rows)) delete r.v[op.id]; }
  else if (op.op === "porder") { const pos = new Map(op.ids.map((x, i) => [x, i])); doc.props.sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999)); }
  else if (op.op === "view") { const i = doc.views.findIndex((v) => v.id === op.view.id); if (i >= 0) doc.views[i] = { ...op.view }; else doc.views.push({ ...op.view }); }
  else if (op.op === "delview") { if (doc.views.length > 1) doc.views = doc.views.filter((v) => v.id !== op.id); }
  else if (op.op === "vorder") { const pos = new Map(op.ids.map((x, i) => [x, i])); doc.views.sort((a, b) => (pos.get(a.id) ?? 99) - (pos.get(b.id) ?? 99)); }
}
addEventListener("pagehide", () => DB.flushAll());
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") DB.flushAll(); else for (const id of docs.keys()) DB.sync(id); });

/* ---------- filters and sorting (shared by every view and by the Planner) ---------- */
export const OPS = {
  text: [["has", "contains"], ["not", "does not contain"], ["is", "is"], ["empty", "is empty"], ["full", "is not empty"]],
  number: [["eq", "="], ["ne", "≠"], ["gt", ">"], ["lt", "<"], ["empty", "is empty"], ["full", "is not empty"]],
  select: [["is", "is"], ["isnt", "is not"], ["empty", "is empty"], ["full", "is not empty"]],
  multi: [["has", "has"], ["hasnt", "does not have"], ["empty", "is empty"], ["full", "is not empty"]],
  date: [["is", "is"], ["before", "is before"], ["after", "is after"], ["today", "is today"], ["week", "is within the next 7 days"], ["past", "is in the past"], ["empty", "is empty"], ["full", "is not empty"]],
  checkbox: [["on", "is checked"], ["off", "is not checked"]],
};
export const opsFor = (t) => OPS[t === "status" ? "select" : ["url", "email", "phone", "relation"].includes(t) ? "text" : t === "created" || t === "edited" ? "date" : t] || OPS.text;
export function valueOf(row, p) {
  if (!p) return "";
  if (p === "title") return row.title || "";
  if (p.type === "created") return ymd(new Date(row.created || 0));
  if (p.type === "edited") return ymd(new Date(row.updated || 0));
  return row.v ? row.v[p.id] : undefined;
}
export function textOf(row, p) {
  const v = valueOf(row, p); if (v == null || v === "") return "";
  if (p === "title") return v;
  if (["select", "status"].includes(p.type)) return (p.opts || []).find((o) => o.id === v)?.name || "";
  if (p.type === "multi") return (v || []).map((x) => (p.opts || []).find((o) => o.id === x)?.name).filter(Boolean).join(", ");
  if (p.type === "date" || p.type === "created" || p.type === "edited") return dateOf(v);
  if (p.type === "checkbox") return v ? "yes" : "";
  return String(v);
}
export function matches(row, f, props) {
  const p = f.p === "title" ? "title" : props.find((x) => x.id === f.p); if (!p) return true;
  const v = valueOf(row, p), t = p === "title" ? "text" : p.type, empty = v == null || v === "" || (Array.isArray(v) && !v.length);
  if (f.op === "empty") return empty; if (f.op === "full") return !empty;
  if (t === "checkbox") return f.op === "on" ? !!v : !v;
  if (f.val == null || f.val === "") return true;
  if (t === "number") { const a = +v, b = +f.val; if (empty) return false; return f.op === "eq" ? a === b : f.op === "ne" ? a !== b : f.op === "gt" ? a > b : a < b; }
  if (t === "select" || t === "status") return f.op === "isnt" ? v !== f.val : v === f.val;
  if (t === "multi") { const has = (v || []).includes(f.val); return f.op === "hasnt" ? !has : has; }
  if (["date", "created", "edited"].includes(t)) {
    const d = dateOf(v).slice(0, 10), td = today();
    if (f.op === "today") return d === td; if (f.op === "past") return !!d && d < td;
    if (f.op === "week") { const lim = ymd(new Date(Date.now() + 7 * 864e5)); return !!d && d >= td && d <= lim; }
    if (!d) return false; return f.op === "before" ? d < f.val : f.op === "after" ? d > f.val : d === f.val;
  }
  const s = textOf(row, p).toLowerCase(), q = String(f.val).toLowerCase();
  return f.op === "not" ? !s.includes(q) : f.op === "is" ? s === q : s.includes(q);
}
export function rowsFor(doc, view, q = "") {
  const props = doc.props;
  let rows = Object.values(doc.rows);
  for (const f of view.filter || []) { const op = opsFor((props.find((p) => p.id === f.p) || { type: "text" }).type); if (op.some(([k]) => k === f.op) || f.p === "title") rows = rows.filter((r) => matches(r, f, props)); }
  if (q) { const s = q.toLowerCase(); rows = rows.filter((r) => (r.title || "").toLowerCase().includes(s) || props.some((p) => textOf(r, p).toLowerCase().includes(s)) || (r.snip || "").toLowerCase().includes(s)); }
  const sorts = (view.sort || []).length ? view.sort : [{ p: "order", d: "asc" }];
  rows.sort((a, b) => {
    for (const s of sorts) {
      let x, y;
      if (s.p === "order") { x = a.order ?? a.created ?? 0; y = b.order ?? b.created ?? 0; }
      else if (s.p === "created" || s.p === "updated") { x = a[s.p] || 0; y = b[s.p] || 0; }
      else { const p = s.p === "title" ? "title" : props.find((q2) => q2.id === s.p); if (!p) continue;
        if (p !== "title" && ["select", "status"].includes(p.type)) { const ix = (id) => { const i = (p.opts || []).findIndex((o) => o.id === id); return i < 0 ? 999 : i; }; x = ix(valueOf(a, p)); y = ix(valueOf(b, p)); }
        else if (p !== "title" && p.type === "number") { x = valueOf(a, p) ?? -Infinity; y = valueOf(b, p) ?? -Infinity; }
        else if (p !== "title" && p.type === "checkbox") { x = valueOf(a, p) ? 1 : 0; y = valueOf(b, p) ? 1 : 0; }
        else { x = textOf(a, p).toLowerCase(); y = textOf(b, p).toLowerCase(); if (!x && y) return 1; if (x && !y) return -1; }
      }
      if (x < y) return s.d === "desc" ? 1 : -1; if (x > y) return s.d === "desc" ? -1 : 1;
    }
    return 0;
  });
  return rows;
}
