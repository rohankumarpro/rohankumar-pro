// /api/ws   Owner only. The workspace: pages of their own and databases (see netlify/lib/ws.mjs).
//   GET                            {pages, dbs}: every page and database (their names, icons and places)
//   GET ?db=<id>                   one database: {meta, doc}
//   GET ?db=<id>&rev=<n>           {same: true} when nothing changed since revision n (live sync)
//   GET ?db=<id>&a=history         earlier copies of a database
//   POST ?a=page {title, icon, parent, cover}      a new page
//   PUT  ?a=page&id=<id> {title, icon, cover, parent, order, fav, trashed, snip, full}
//   POST ?a=db {title, tpl, icon, parent}          a new database from a template (blank, tasks, projects, reading, content)
//   PUT  ?a=db&id=<id> {title, icon, cover, fav, trashed, order, parent, desc}
//   POST ?db=<id>&a=ops {ops:[...]}                change rows, properties and views (see applyOps)
//   POST ?db=<id>&a=restore {ts}                   put an earlier copy back (what is there now is kept first)
// The writing inside pages and rows is saved through /api/boards?page=<id>, like every other page.
// Functions 2.0, so reads are strongly consistent and a save never builds on an old copy.
import { getStore } from "@netlify/blobs";
import { isAdmin, json } from "../lib/session.mjs";
import { isPreviewHost } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { PAGES, DBS, okId, loadList, loadDb, createPage, updatePage, createDb, updateDbMeta, applyOps, dbKey, dbHistKey } from "../lib/ws.mjs";

let strongOk = true;
function wsStore(name) {
  const strong = getStore({ name, consistency: "strong" }), plain = getStore(name);
  return {
    async get(k, o) { if (strongOk) { try { return await strong.get(k, o); } catch (e) { if (e && e.name === "BlobsConsistencyError") strongOk = false; else throw e; } } return plain.get(k, o); },
    set: (k, v, o) => plain.set(k, v, o), setJSON: (k, v, o) => plain.setJSON(k, v, o), delete: (k) => plain.delete(k), list: (o) => plain.list(o),
  };
}
const out = (r) => new Response(r.body, { status: r.statusCode, headers: r.headers });

export default async (req) => {
  const u = new URL(req.url), q = Object.fromEntries(u.searchParams), m = req.method;
  const event = { headers: Object.fromEntries(req.headers) };
  try {
    if (!isAdmin(event)) return out(json({ error: "Not signed in" }, 401));
    const preview = isPreviewHost(event);
    const store = wsStore(preview ? "site-content-dev" : "site-content"), backups = () => getStore(preview ? "site-backups-dev" : "site-backups");
    let b = {}; if (m !== "GET") { try { b = JSON.parse((await req.text()) || "{}") || {}; } catch { return out(json({ error: "Bad request" }, 400)); } }
    if (q.db && !okId(q.db)) return out(json({ error: "Not found" }, 404));
    if (q.id && !okId(q.id)) return out(json({ error: "Not found" }, 404));

    if (m === "GET") {
      if (q.db) {
        if (q.a === "history") return out(json({ history: ((await store.get(dbHistKey(q.db), { type: "json" })) ?? []).map((h) => ({ ts: h.ts, rows: Object.keys(h.doc.rows || {}).length })) }));
        const doc = await loadDb(store, q.db); if (!doc) return out(json({ error: "Not found" }, 404));
        if (q.rev && +q.rev === doc.rev) return out(json({ same: true, rev: doc.rev }));
        const meta = (await loadList(store, DBS)).find((d) => d.id === q.db) || null;
        return out(json({ meta, doc }));
      }
      const [pages, dbs] = await Promise.all([loadList(store, PAGES), loadList(store, DBS)]);
      return out(json({ pages, dbs }));
    }
    if (m === "POST" && q.a === "page") { const p = await createPage(store, b); return p ? out(json({ page: p })) : out(json({ error: "Too many pages" }, 400)); }
    if (m === "PUT" && q.a === "page") { const p = await updatePage(store, q.id, b); await maybeSnapshot(store, backups()); return p ? out(json({ page: p })) : out(json({ error: "Not found" }, 404)); }
    if (m === "POST" && q.a === "db" && !q.db) { const r = await createDb(store, b); return r ? out(json(r)) : out(json({ error: "Too many databases" }, 400)); }
    if (m === "PUT" && q.a === "db") { const r = await updateDbMeta(store, q.id, b); return r ? out(json({ meta: r })) : out(json({ error: "Not found" }, 404)); }
    if (m === "POST" && q.db && q.a === "ops") {
      const r = await applyOps(store, q.db, b.ops); if (!r) return out(json({ error: "Not found" }, 404));
      if (!r.same) await maybeSnapshot(store, backups());
      return out(json({ ok: true, rev: r.doc.rev, updated: r.doc.updated, doc: b.full ? r.doc : undefined }));
    }
    if (m === "POST" && q.db && q.a === "restore") {
      const hist = (await store.get(dbHistKey(q.db), { type: "json" })) ?? [], h = hist.find((x) => x.ts === +b.ts), cur = await loadDb(store, q.db);
      if (!h || !cur) return out(json({ error: "Not found" }, 404));
      await store.setJSON(dbHistKey(q.db), [{ ts: Date.now(), doc: cur }, ...hist].slice(0, 20));
      const doc = { ...h.doc, rev: (cur.rev || 0) + 1, updated: Date.now() }; await store.setJSON(dbKey(q.db), doc);
      return out(json({ ok: true, doc }));
    }
    return out(json({ error: "Method not allowed" }, 405));
  } catch (e) {
    return out(json({ error: "Server error", detail: String(e?.message || e) }, 500));
  }
};
