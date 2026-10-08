// What Claude can do in the owner's workspace through the private connector (/api/mcp).
// Every change goes through the same cleaners and history copies as the apps use, so nothing here can write a shape
// the apps don't understand, and earlier copies are kept the usual way. The vault is never read.
import { PAGES, DBS, okId, loadList, loadDb, createPage, updatePage, createDb, applyOps } from "./ws.mjs";
import { loadPage, savePage } from "./boards.mjs";
import { LIB, vKey, KINDS, loadLib, cleanLib, cleanVideo, keepCopy } from "./studio.mjs";
import { accounts, g, eventBody, refresh, SCOPES, CAL, MAIL, SEEN } from "./gapi.mjs";
import { cleanBlocks, blocksToMd, blocksText, mdInline, stripTags } from "../../shared/blocks.mjs";

const rid = () => Math.random().toString(36).slice(2, 10);
const DAY = 864e5;
const fail = (msg) => { throw Object.assign(new Error(msg), { user: true }); };

/* ---------- dates in the owner's time zone ---------- */
const TZ = "Asia/Kolkata";
const ymdIn = (ms, tz = TZ) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const okTz = (tz) => { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch { return TZ; } };

/* ---------- markdown <-> page blocks ---------- */
export function mdBlocks(md) {
  const out = [], lines = String(md || "").replace(/\r/g, "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], t = raw.trim(); let m;
    if (!t) continue;
    if (t.startsWith("```")) { const code = []; while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]); out.push({ id: rid(), t: "code", x: code.join("\n"), lang: t.slice(3).trim() }); continue; }
    if (/^(---|\*\*\*|___)$/.test(t)) { out.push({ id: rid(), t: "divider" }); continue; }
    const d = Math.min(3, Math.floor((raw.match(/^\s*/)[0].replace(/\t/g, "  ").length) / 2));
    if ((m = t.match(/^(#{1,3})\s+(.*)$/))) { out.push({ id: rid(), t: "h" + m[1].length, h: mdInline(m[2]) }); continue; }
    if ((m = t.match(/^[-*]\s+\[( |x|X)\]\s+(.*)$/))) { out.push({ id: rid(), t: "todo", c: m[1] !== " ", h: mdInline(m[2]), d }); continue; }
    if ((m = t.match(/^[-*+]\s+(.*)$/))) { out.push({ id: rid(), t: "ul", h: mdInline(m[1]), d }); continue; }
    if ((m = t.match(/^\d+[.)]\s+(.*)$/))) { out.push({ id: rid(), t: "ol", h: mdInline(m[1]), d }); continue; }
    if (t.startsWith(">")) { const q = [t.replace(/^>\s?/, "")]; while (i + 1 < lines.length && lines[i + 1].trim().startsWith(">")) q.push(lines[++i].trim().replace(/^>\s?/, "")); out.push({ id: rid(), t: "quote", h: q.map(mdInline).join("<br>") }); continue; }
    const p = [t]; while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#{1,3}\s|[-*+]\s|\d+[.)]\s|>|```|---$)/.test(lines[i + 1].trim())) p.push(lines[++i].trim());
    out.push({ id: rid(), t: "p", h: p.map(mdInline).join("<br>") });
  }
  return cleanBlocks(out);
}
const snipOf = (blocks) => blocksText(blocks, " ").replace(/\s+/g, " ").trim().slice(0, 320);

/* ---------- databases: values by property name ---------- */
const findDb = async (store, ref) => {
  const dbs = (await loadList(store, DBS)).filter((d) => !d.trashed);
  const r = String(ref || "").trim().toLowerCase();
  return dbs.find((d) => d.id === ref) || dbs.find((d) => (d.title || "").toLowerCase() === r) || dbs.find((d) => d.role === r) || dbs.find((d) => (d.title || "").toLowerCase().includes(r)) || null;
};
// the database behind an app (Tasks, Library, Subscriptions, Studio); made from its template only when there is none yet
async function roleDb(store, role, make = true) {
  const dbs = await loadList(store, DBS);
  let m = dbs.find((d) => d.role === role && !d.trashed);
  if (!m && !make) return { meta: null, doc: { props: [], rows: {} } };
  if (!m) { const made = await createDb(store, { tpl: role }); if (!made) fail("Could not make the database"); m = made.meta; }
  return { meta: m, doc: await loadDb(store, m.id) };
}
const optName = (p, id) => (p.opts || []).find((o) => o.id === id)?.name;
function readVal(p, v) {
  if (v == null) return null;
  if (p.type === "select" || p.type === "status") return optName(p, v) || null;
  if (p.type === "multi") return (v || []).map((x) => optName(p, x)).filter(Boolean);
  if (p.type === "date" && typeof v === "object") return v.s + " to " + v.e;
  return v;
}
export function rowOut(doc, r, full) {
  const o = { id: r.id, title: r.title || "Untitled" };
  for (const p of doc.props) { if (p.type === "created") o[p.name] = ymdIn(r.created || 0); else if (p.type === "edited") o[p.name] = ymdIn(r.updated || 0); else { const v = readVal(p, r.v?.[p.id]); if (v != null && !(Array.isArray(v) && !v.length)) o[p.name] = v; } }
  if (full && r.snip) o.preview = r.snip;
  return o;
}
// {name: value} from Claude -> the row's {propId: value}; options that don't exist yet are added to select and multi properties
function writeVals(doc, vals, ops) {
  const v = {};
  for (const [name, val] of Object.entries(vals || {})) {
    const p = doc.props.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); if (!p) fail(`No property called "${name}". It has: ${doc.props.map((x) => x.name).join(", ")}`);
    if (val == null || val === "") { v[p.id] = null; continue; }
    if (["select", "status", "multi"].includes(p.type)) {
      const want = (Array.isArray(val) ? val : String(val).split(/\s*,\s*/)).map(String).filter(Boolean);
      const ids = want.map((n) => {
        let o = (p.opts || []).find((x) => x.name.toLowerCase() === n.toLowerCase());
        if (!o && p.type === "status") o = (p.opts || []).find((x) => x.group === ({ "to do": "todo", todo: "todo", open: "todo", doing: "doing", "in progress": "doing", done: "done", complete: "done", completed: "done" })[n.toLowerCase()]);
        if (!o && p.type !== "status") { o = { id: rid(), name: n.slice(0, 60), color: "grey" }; p.opts = [...(p.opts || []), o]; ops.push({ op: "prop", prop: p }); }
        if (!o) fail(`"${n}" is not a ${p.name} option. Options: ${(p.opts || []).map((x) => x.name).join(", ")}`);
        return o.id;
      });
      v[p.id] = p.type === "multi" ? ids : ids[0];
    } else if (p.type === "number") v[p.id] = +val;
    else if (p.type === "checkbox") v[p.id] = val === true || /^(true|yes|1|done)$/i.test(String(val));
    else if (p.type === "date") { const s = String(val).trim().replace(" ", "T").slice(0, 16); if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(s)) fail(`${p.name} needs a date like 2026-10-08 or 2026-10-08T15:30`); v[p.id] = s; }
    else v[p.id] = String(val);
  }
  return v;
}
const statusProp = (doc) => doc.props.find((p) => p.type === "status");
const isDone = (doc, r) => { const s = statusProp(doc); if (s) return (s.opts || []).find((o) => o.id === r.v?.[s.id])?.group === "done"; const c = doc.props.find((p) => p.type === "checkbox"); return !!(c && r.v?.[c.id]); };
const dateOf = (doc, r, name) => { const p = doc.props.find((x) => x.type === "date" && (!name || x.name === name)); const v = p && r.v?.[p.id]; return v ? (typeof v === "object" ? v.s : v) : ""; };

async function writeBody(store, id, md, mode) {
  const cur = await loadPage(store, id), add = mdBlocks(md);
  const blocks = mode === "replace" ? add : [...(cur.blocks || []), ...add];
  const r = await savePage(store, id, { blocks });
  return r.snip;
}

/* ---------- the tools ---------- */
const S = (props, req = []) => ({ type: "object", properties: props, required: req, additionalProperties: false });
const str = (d) => ({ type: "string", description: d }), int = (d) => ({ type: "integer", description: d }), obj = (d) => ({ type: "object", description: d, additionalProperties: true });

export const TOOLS = [
  { name: "today", title: "Today", description: "The owner's day at a glance: calendar events, tasks due or overdue, important unread email and subscriptions renewing soon. Use this first for 'what's on today' or planning questions.", inputSchema: S({ date: str("Day as YYYY-MM-DD (default today)"), tz: str("IANA time zone (default Asia/Kolkata)") }), annotations: { readOnlyHint: true } },
  { name: "search", title: "Search everything", description: "Search pages, database rows (tasks, books, videos, subscriptions...) and notes by words. Returns ids to use with read_page or update_row.", inputSchema: S({ query: str("Words to look for") }, ["query"]), annotations: { readOnlyHint: true } },
  { name: "list_tasks", title: "List tasks", description: "Tasks from the Tasks app.", inputSchema: S({ show: { type: "string", enum: ["open", "done", "all"], description: "Default open" }, due_by: str("Only tasks due on or before this YYYY-MM-DD") }), annotations: { readOnlyHint: true } },
  { name: "add_task", title: "Add a task", description: "Add a task to the Tasks app.", inputSchema: S({ title: str("What to do"), due: str("YYYY-MM-DD or YYYY-MM-DDTHH:MM"), priority: { type: "string", enum: ["High", "Medium", "Low"] }, area: str("Work, Content, Personal or a new one"), notes: str("Markdown written inside the task") }, ["title"]) },
  { name: "update_task", title: "Change a task", description: "Change or complete a task (use list_tasks or search for its id).", inputSchema: S({ id: str("Task id"), title: str("New title"), status: str("To do, Doing or Done"), due: str("YYYY-MM-DD, or empty to clear"), priority: str("High, Medium or Low") }, ["id"]) },
  { name: "list_databases", title: "List databases", description: "Every database in the workspace with its properties.", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "query_database", title: "Read a database", description: "Rows of one database (by id or name, e.g. 'Library', 'Content calendar'), newest first.", inputSchema: S({ database: str("Database id or name"), contains: str("Only rows whose title contains this"), limit: int("Max rows (default 50)") }, ["database"]), annotations: { readOnlyHint: true } },
  { name: "add_row", title: "Add a row", description: "Add a row to a database. properties is {\"Property name\": value}; options are matched by name.", inputSchema: S({ database: str("Database id or name"), title: str("Row title"), properties: obj("Values by property name"), markdown: str("Optional page text inside the row") }, ["database", "title"]) },
  { name: "update_row", title: "Change a row", description: "Change a row's title or properties.", inputSchema: S({ database: str("Database id or name"), id: str("Row id"), title: str("New title"), properties: obj("Values by property name; empty string clears") }, ["database", "id"]) },
  { name: "read_page", title: "Read a page", description: "Read a workspace page, or the page inside a database row (task, book, video...), as markdown.", inputSchema: S({ id: str("Page or row id") }, ["id"]), annotations: { readOnlyHint: true } },
  { name: "create_page", title: "Create a page", description: "Create a new workspace page from markdown.", inputSchema: S({ title: str("Page title"), markdown: str("Content (headings, lists, - [ ] to-dos, quotes, code)"), parent_id: str("Optional parent page id") }, ["title"]) },
  { name: "write_page", title: "Write in a page", description: "Add markdown to the end of a page or row page, or replace all of it (an earlier copy is kept).", inputSchema: S({ id: str("Page or row id"), markdown: str("Content"), mode: { type: "string", enum: ["append", "replace"], description: "Default append" } }, ["id", "markdown"]), annotations: { destructiveHint: true } },
  { name: "calendar", title: "Calendar", description: "Calendar events between two days from every connected Google account.", inputSchema: S({ from: str("YYYY-MM-DD (default today)"), to: str("YYYY-MM-DD (default a week later)") }), annotations: { readOnlyHint: true } },
  { name: "add_event", title: "Add a calendar event", description: "Create an event in Google Calendar.", inputSchema: S({ title: str("Event title"), start: str("YYYY-MM-DDTHH:MM, or YYYY-MM-DD for all day"), end: str("Same format; default one hour later"), location: str(""), description: str(""), account: str("Account email (default the first that can write)"), tz: str("IANA time zone (default Asia/Kolkata)") }, ["title", "start"]) },
  { name: "important_email", title: "Important email", description: "Recent important and starred email (subjects and snippets only) from connected accounts.", inputSchema: S({ unread_only: { type: "boolean" } }), annotations: { readOnlyHint: true } },
  { name: "studio_videos", title: "Studio videos", description: "Videos in the Studio pipeline with their stage and publish date.", inputSchema: S({ stage: str("Idea, Scripting, Filming, Editing or Published") }), annotations: { readOnlyHint: true } },
  { name: "add_video", title: "Add a video idea", description: "Add a video to the Studio pipeline.", inputSchema: S({ title: str("Working title"), topic: str("What it is about"), promise: str("What the viewer gets"), stage: str("Default Idea"), publish: str("YYYY-MM-DD"), format: { type: "string", enum: ["long", "short"] } }, ["title"]) },
  { name: "get_video_plan", title: "Read a video plan", description: "A Studio video's plan: topic, promise, timed parts with scripts and b-roll, title ideas, description.", inputSchema: S({ id: str("Video row id (from studio_videos)") }, ["id"]), annotations: { readOnlyHint: true } },
  { name: "update_video_plan", title: "Write a video plan", description: "Write a Studio video's plan. Only the fields given change. parts replaces all parts: [{kind, title, script, seconds, broll:[...]}], kind one of " + KINDS.join(", ") + ". An earlier copy is kept.", inputSchema: S({ id: str("Video row id"), topic: str(""), promise: str(""), audience: str(""), target_seconds: int("Planned length"), parts: { type: "array", items: { type: "object", additionalProperties: true } }, titles: { type: "array", items: { type: "string" } }, thumbnails: { type: "array", items: { type: "string" } }, description: str("YouTube description"), tags: str("Comma separated") }, ["id"]), annotations: { destructiveHint: true } },
  { name: "studio_blocks", title: "Studio blocks", description: "Reusable hooks, rehooks, stakes, CTAs and other script blocks, and the formulas (video structures).", inputSchema: S({ kind: { type: "string", enum: KINDS }, contains: str("Words to look for") }), annotations: { readOnlyHint: true } },
  { name: "add_studio_block", title: "Save a Studio block", description: "Save a reusable script block (hook, rehook, stakes...). Use {topic} style blanks for parts that change.", inputSchema: S({ kind: { type: "string", enum: KINDS }, name: str("Short name"), text: str("The block"), tags: { type: "array", items: { type: "string" } } }, ["kind", "text"]) },
  { name: "library", title: "Library", description: "Books in the Library with status, progress and rating.", inputSchema: S({ status: str("To read, Reading or Finished") }), annotations: { readOnlyHint: true } },
  { name: "add_book", title: "Add a book", description: "Add a book to the Library.", inputSchema: S({ title: str(""), author: str(""), status: str("To read, Reading or Finished"), pages: int(""), notes: str("Markdown notes inside the book") }, ["title"]) },
  { name: "subscriptions", title: "Subscriptions", description: "Subscriptions with amount, cycle, next charge, and monthly totals per currency.", inputSchema: S({}), annotations: { readOnlyHint: true } },
  { name: "notes", title: "Notes", description: "The owner's notes (read only). Without a query, the latest titles.", inputSchema: S({ query: str("Words to look for"), id: str("One note's id for its full text") }), annotations: { readOnlyHint: true } },
];

export async function callTool(store, name, a = {}) {
  switch (name) {
    case "today": {
      const tz = okTz(a.tz || TZ), day = /^\d{4}-\d{2}-\d{2}$/.test(a.date || "") ? a.date : ymdIn(Date.now(), tz);
      const cal = (await store.get(CAL, { type: "json" })) ?? null, mail = (await store.get(MAIL, { type: "json" })) ?? null, seen = new Set((await store.get(SEEN, { type: "json" })) ?? []);
      const events = Object.values(cal?.accounts || {}).flatMap((x) => x.events || []).filter((e) => (e.allDay ? e.s <= day && (e.e || e.s) > day : ymdIn(Date.parse(e.s), tz) === day)).sort((x, y) => (x.allDay ? 0 : Date.parse(x.s)) - (y.allDay ? 0 : Date.parse(y.s))).map((e) => ({ title: e.t, start: e.allDay ? "all day" : new Date(e.s).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }), end: e.allDay ? "" : new Date(e.e).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }), where: e.loc || undefined, meet: e.meet || undefined }));
      const { doc: tdoc } = await roleDb(store, "tasks", false);
      const tasks = Object.values(tdoc.rows).filter((r) => !isDone(tdoc, r) && dateOf(tdoc, r) && dateOf(tdoc, r).slice(0, 10) <= day).map((r) => ({ ...rowOut(tdoc, r), overdue: dateOf(tdoc, r).slice(0, 10) < day || undefined }));
      const email = Object.values(mail?.accounts || {}).flatMap((x) => x.msgs || []).filter((m) => m.unread && !seen.has(m.id)).slice(0, 10).map((m) => ({ from: m.from, subject: m.subj, snippet: m.snip }));
      const subs = await subsList(store), soon = ymdIn(Date.parse(day) + 7 * DAY, tz);
      return { day, events, tasks, important_email: email, renewing_this_week: subs.list.filter((s) => s["Next charge"] && s["Next charge"] >= day && s["Next charge"] <= soon && s.Status !== "Cancelled"), calendar_synced: cal ? new Date(cal.ts).toISOString() : "Google not connected" };
    }
    case "search": {
      const q = String(a.query || "").toLowerCase().split(/\s+/).filter(Boolean); if (!q.length) fail("Give some words to search for");
      const hit = (t) => { t = String(t || "").toLowerCase(); return q.every((w) => t.includes(w)); };
      const out = [];
      for (const p of await loadList(store, PAGES)) if (!p.trashed && hit((p.title || "") + " " + (p.snip || ""))) out.push({ kind: "page", id: p.id, title: p.title || "Untitled", preview: p.snip || undefined });
      for (const d of (await loadList(store, DBS)).filter((x) => !x.trashed)) { const doc = await loadDb(store, d.id); if (!doc) continue; for (const r of Object.values(doc.rows)) if (hit((r.title || "") + " " + (r.snip || ""))) out.push({ kind: "row", database: d.title, database_id: d.id, ...rowOut(doc, r, true) }); }
      for (const n of (await store.get("notes", { type: "json" })) ?? []) if (!n.trashed && hit((n.title || "") + " " + (n.text || ""))) out.push({ kind: "note", id: n.id, title: n.title || "Untitled", preview: String(n.text || "").slice(0, 200) });
      return { results: out.slice(0, 40), more: out.length > 40 || undefined };
    }
    case "list_tasks": {
      const { doc } = await roleDb(store, "tasks", false), show = a.show || "open";
      let rows = Object.values(doc.rows).filter((r) => show === "all" || (show === "done") === isDone(doc, r));
      if (a.due_by) rows = rows.filter((r) => dateOf(doc, r) && dateOf(doc, r).slice(0, 10) <= a.due_by);
      rows.sort((x, y) => (dateOf(doc, x) || "9999").localeCompare(dateOf(doc, y) || "9999") || (y.created || 0) - (x.created || 0));
      return { tasks: rows.slice(0, 200).map((r) => rowOut(doc, r)) };
    }
    case "add_task": {
      const { meta, doc } = await roleDb(store, "tasks"), ops = [];
      const vals = {}; if (a.due) vals.Due = a.due; if (a.priority) vals.Priority = a.priority; if (a.area) vals.Area = a.area;
      const st = statusProp(doc); if (st) vals[st.name] = (st.opts || []).find((o) => o.group === "todo")?.name;
      return addRow(store, meta, doc, ops, a.title, vals, a.notes);
    }
    case "update_task": {
      const { meta, doc } = await roleDb(store, "tasks"), vals = {};
      if (a.status != null) vals[statusProp(doc)?.name || "Status"] = a.status; if (a.due != null) vals.Due = a.due; if (a.priority != null) vals.Priority = a.priority;
      return updRow(store, meta, doc, a.id, a.title, vals);
    }
    case "list_databases": return { databases: (await loadList(store, DBS)).filter((d) => !d.trashed).map((d) => ({ id: d.id, title: d.title, rows: d.count || 0, app: d.role || undefined })).concat([]), note: "Use query_database for rows and properties." };
    case "query_database": {
      const m = await findDb(store, a.database); if (!m) fail("No database by that name");
      const doc = await loadDb(store, m.id), q = String(a.contains || "").toLowerCase();
      const rows = Object.values(doc.rows).filter((r) => !q || (r.title || "").toLowerCase().includes(q)).sort((x, y) => (y.updated || 0) - (x.updated || 0));
      return { database: m.title, id: m.id, properties: doc.props.map((p) => ({ name: p.name, type: p.type, options: p.opts ? p.opts.map((o) => o.name) : undefined })), total: rows.length, rows: rows.slice(0, Math.max(1, Math.min(200, a.limit || 50))).map((r) => rowOut(doc, r, true)) };
    }
    case "add_row": { const m = await findDb(store, a.database); if (!m) fail("No database by that name"); return addRow(store, m, await loadDb(store, m.id), [], a.title, a.properties, a.markdown); }
    case "update_row": { const m = await findDb(store, a.database); if (!m) fail("No database by that name"); return updRow(store, m, await loadDb(store, m.id), a.id, a.title, a.properties); }
    case "read_page": {
      if (!okId(a.id)) fail("That id doesn't look right");
      const page = (await loadList(store, PAGES)).find((p) => p.id === a.id);
      let head = page ? { kind: "page", title: page.title || "Untitled", parent_id: page.parent || undefined, subpages: (await loadList(store, PAGES)).filter((p) => p.parent === a.id && !p.trashed).map((p) => ({ id: p.id, title: p.title })) } : null;
      if (!head) for (const d of (await loadList(store, DBS)).filter((x) => !x.trashed)) { const doc = await loadDb(store, d.id); const r = doc && doc.rows[a.id]; if (r) { head = { kind: "row", database: d.title, properties: rowOut(doc, r) }; break; } }
      if (!head) fail("No page or row with that id");
      const body = await loadPage(store, a.id);
      return { ...head, markdown: blocksToMd(body.blocks || []) || "(empty)" };
    }
    case "create_page": {
      const parent = a.parent_id && okId(a.parent_id) ? a.parent_id : null;
      const p = await createPage(store, { title: String(a.title || "Untitled"), parent }); if (!p) fail("The workspace is full");
      if (a.markdown) { const snip = await writeBody(store, p.id, a.markdown, "replace"); await updatePage(store, p.id, { snip }); }
      return { ok: true, id: p.id, title: p.title };
    }
    case "write_page": {
      if (!okId(a.id)) fail("That id doesn't look right");
      const page = (await loadList(store, PAGES)).find((p) => p.id === a.id);
      let db = null; if (!page) for (const d of (await loadList(store, DBS)).filter((x) => !x.trashed)) { const doc = await loadDb(store, d.id); if (doc && doc.rows[a.id]) { db = d; break; } }
      if (!page && !db) fail("No page or row with that id");
      const snip = await writeBody(store, a.id, a.markdown, a.mode === "replace" ? "replace" : "append");
      if (page) await updatePage(store, a.id, { snip }); else await applyOps(store, db.id, [{ op: "row", row: { id: a.id, snip } }]);
      return { ok: true };
    }
    case "calendar": {
      const cal = (await store.get(CAL, { type: "json" })) ?? null; if (!cal) return { events: [], note: "No Google account is connected yet (Settings, Google accounts)." };
      const from = a.from || ymdIn(Date.now()), to = a.to || ymdIn(Date.parse(from) + 7 * DAY);
      const events = Object.values(cal.accounts || {}).flatMap((x) => (x.events || []).map((e) => ({ ...e, account: x.email }))).filter((e) => String(e.s).slice(0, 10) <= to && String(e.e || e.s).slice(0, 10) >= from);
      return { from, to, events: events.slice(0, 300).map((e) => ({ title: e.t, start: e.s, end: e.e, all_day: e.allDay || undefined, where: e.loc || undefined, account: e.account, meet: e.meet || undefined })), synced: new Date(cal.ts).toISOString() };
    }
    case "add_event": {
      const accts = (await accounts(store)).filter((x) => x.cal !== false);
      const acct = (a.account && accts.find((x) => x.email === a.account)) || accts[0]; if (!acct) fail("No Google account is connected (Settings, Google accounts).");
      const allDay = /^\d{4}-\d{2}-\d{2}$/.test(a.start || ""); if (!allDay && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(a.start || "")) fail("start needs YYYY-MM-DDTHH:MM or YYYY-MM-DD");
      let end = a.end; if (!end && !allDay) { const [d, t] = a.start.split("T"), [h, mi] = t.split(":").map(Number), mins = h * 60 + mi + 60; end = mins >= 1440 ? a.start : `${d}T${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`; }
      const ev = await g(store, acct, SCOPES.cal, "https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", body: JSON.stringify(eventBody({ t: a.title, s: a.start.slice(0, 16), e: (end || a.start).slice(0, 16), allDay, loc: a.location, desc: a.description, tz: okTz(a.tz || TZ) })) });
      await refresh(store, { budgetMs: 4000, mail: false }).catch(() => {});
      return { ok: true, link: ev && ev.htmlLink, account: acct.email };
    }
    case "important_email": {
      const mail = (await store.get(MAIL, { type: "json" })) ?? null; if (!mail) return { email: [], note: "No Google account is connected yet." };
      const msgs = Object.values(mail.accounts || {}).flatMap((x) => (x.msgs || []).map((m) => ({ ...m, account: x.email }))).filter((m) => !a.unread_only || m.unread).sort((x, y) => y.ts - x.ts);
      return { email: msgs.slice(0, 40).map((m) => ({ from: `${m.from} <${m.fromEmail}>`, subject: m.subj, snippet: m.snip, date: new Date(m.ts).toISOString(), unread: m.unread, starred: m.star || undefined, account: m.account })) };
    }
    case "studio_videos": {
      const { doc } = await roleDb(store, "content", false);
      let rows = Object.values(doc.rows).map((r) => rowOut(doc, r)); if (a.stage) rows = rows.filter((r) => String(r.Stage || "").toLowerCase() === a.stage.toLowerCase());
      return { videos: rows.sort((x, y) => String(x.Publish || "9999").localeCompare(String(y.Publish || "9999"))) };
    }
    case "add_video": {
      const { meta, doc } = await roleDb(store, "content"), vals = { Stage: a.stage || "Idea" }; if (a.publish) vals.Publish = a.publish;
      const r = await addRow(store, meta, doc, [], a.title, vals);
      if (a.topic || a.promise || a.format) await store.setJSON(vKey(r.id), { ...cleanVideo({ topic: a.topic || a.title, promise: a.promise, fmt: a.format }), rev: 1, updated: Date.now() });
      return r;
    }
    case "get_video_plan": {
      if (!okId(a.id)) fail("That id doesn't look right");
      const v = await store.get(vKey(a.id), { type: "json" }); if (!v) return { id: a.id, plan: null, note: "No plan yet. update_video_plan writes one." };
      return { id: a.id, topic: v.topic, promise: v.promise, audience: v.audience, format: v.fmt, target_seconds: v.target, words_per_minute: v.wpm, parts: v.segs.map((s) => ({ kind: s.kind, title: s.title, script: s.script, seconds: s.sec ?? s.plan ?? undefined, broll: (s.broll || []).map((b) => b.t) })), titles: v.titles.map((x) => x.t), thumbnails: v.thumbs.map((x) => x.t), description: v.desc, tags: v.tags };
    }
    case "update_video_plan": {
      if (!okId(a.id)) fail("That id doesn't look right");
      const cur = (await store.get(vKey(a.id), { type: "json" })) ?? null, base = cur || {};
      const next = { ...base };
      if (a.topic != null) next.topic = a.topic; if (a.promise != null) next.promise = a.promise; if (a.audience != null) next.audience = a.audience; if (a.target_seconds != null) next.target = a.target_seconds;
      if (a.description != null) next.desc = a.description; if (a.tags != null) next.tags = a.tags;
      if (Array.isArray(a.titles)) next.titles = a.titles.map((t) => ({ t: String(t) }));
      if (Array.isArray(a.thumbnails)) next.thumbs = a.thumbnails.map((t) => ({ t: String(t) }));
      if (Array.isArray(a.parts)) next.segs = a.parts.map((p) => ({ kind: KINDS.includes(p.kind) ? p.kind : "point", title: p.title || "", script: p.script || "", sec: p.seconds ?? null, plan: p.seconds || undefined, broll: (Array.isArray(p.broll) ? p.broll : []).map((t) => ({ t: String(typeof t === "object" ? t.t || t.text || "" : t) })) }));
      if (cur) await keepCopy(store, a.id, cur, true);
      const doc = { ...cleanVideo(next), rev: (cur ? cur.rev || 0 : 0) + 1, updated: Date.now() };
      await store.setJSON(vKey(a.id), doc);
      return { ok: true, parts: doc.segs.length, note: "Open it in Studio to see the timeline." };
    }
    case "studio_blocks": {
      const lib = await loadLib(store), q = String(a.contains || "").toLowerCase();
      const blocks = lib.blocks.filter((b) => (!a.kind || b.kind === a.kind) && (!q || (b.name + " " + b.text + " " + (b.tags || []).join(" ")).toLowerCase().includes(q)));
      const kinds = Object.fromEntries(KINDS.map((k) => [k, lib.blocks.filter((b) => b.kind === k).length]));
      return { blocks: blocks.slice(0, 80).map((b) => ({ kind: b.kind, name: b.name, text: b.text, favourite: b.fav || undefined })), total: blocks.length, by_kind: kinds, formulas: a.kind || q ? undefined : lib.formulas.map((f) => ({ name: f.name, format: f.fmt, about: f.desc, steps: f.steps.map((s) => `${s.kind} ${s.sec}s`).join(", ") })) };
    }
    case "add_studio_block": {
      const lib = await loadLib(store);
      const c = cleanLib({ blocks: [...lib.blocks, { kind: a.kind, name: a.name || String(a.text).slice(0, 40), text: a.text, tags: a.tags || [], mine: true }], formulas: lib.formulas });
      await store.setJSON(LIB, { ...lib, ...c, rev: (lib.rev || 0) + 1, updated: Date.now() });
      return { ok: true, blocks: c.blocks.length };
    }
    case "library": {
      const { doc } = await roleDb(store, "reading", false);
      let rows = Object.values(doc.rows).map((r) => rowOut(doc, r)); if (a.status) rows = rows.filter((r) => String(r.Status || "").toLowerCase() === a.status.toLowerCase());
      return { books: rows };
    }
    case "add_book": {
      const { meta, doc } = await roleDb(store, "reading"), vals = { Status: a.status || "To read" }; if (a.author) vals.Author = a.author; if (a.pages) vals.Pages = a.pages;
      return addRow(store, meta, doc, [], a.title, vals, a.notes);
    }
    case "subscriptions": return subsList(store);
    case "notes": {
      const all = ((await store.get("notes", { type: "json" })) ?? []).filter((n) => !n.trashed);
      if (a.id) { const n = all.find((x) => x.id === a.id); if (!n) fail("No note with that id"); return { id: n.id, title: n.title, text: n.blocks?.length ? blocksToMd(n.blocks) : n.text, items: (n.items || []).map((i) => (i.d ? "[x] " : "[ ] ") + i.t) }; }
      const q = String(a.query || "").toLowerCase();
      return { notes: all.filter((n) => !q || ((n.title || "") + " " + (n.text || "")).toLowerCase().includes(q)).slice(0, 60).map((n) => ({ id: n.id, title: n.title || "Untitled", preview: stripTags(n.text || "").slice(0, 160) })) };
    }
  }
  fail("Unknown tool " + name);
}

async function addRow(store, meta, doc, ops, title, vals, md) {
  const v = writeVals(doc, vals, ops), id = rid() + rid().slice(0, 2);
  ops.push({ op: "row", row: { id, title: String(title || "Untitled").slice(0, 300), v, order: Date.now() } });
  await applyOps(store, meta.id, ops);
  if (md) { const snip = await writeBody(store, id, md, "replace"); await applyOps(store, meta.id, [{ op: "row", row: { id, snip } }]); }
  return { ok: true, id, database: meta.title };
}
async function updRow(store, meta, doc, id, title, vals) {
  if (!doc.rows[id]) fail(`No row with id ${id} in ${meta.title}`);
  const ops = [], v = writeVals(doc, vals, ops), row = { id, v };
  if (title != null) row.title = String(title).slice(0, 300);
  ops.push({ op: "row", row });
  const r = await applyOps(store, meta.id, ops);
  return { ok: true, row: rowOut(r.doc, r.doc.rows[id]) };
}
async function subsList(store) {
  const { doc } = await roleDb(store, "subs", false), list = Object.values(doc.rows).map((r) => rowOut(doc, r));
  const per = { Monthly: 1, Yearly: 1 / 12, Quarterly: 1 / 3, "Half-yearly": 1 / 6, Weekly: 52 / 12 }, monthly = {};
  for (const s of list) if (s.Status !== "Cancelled" && s.Amount) { const c = s.Currency || "INR"; monthly[c] = Math.round(((monthly[c] || 0) + s.Amount * (per[s.Cycle] ?? 1)) * 100) / 100; }
  return { list: list.sort((x, y) => String(x["Next charge"] || "9999").localeCompare(String(y["Next charge"] || "9999"))), monthly_total: monthly };
}
