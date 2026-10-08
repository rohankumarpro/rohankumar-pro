// /api/studio   Owner only. Content Studio (see netlify/lib/studio.mjs).
//   GET ?a=lib                    the blocks library and formulas (the starter set is written the first time)
//   PUT ?a=lib {blocks, formulas, base}      replace them (409 when another device saved since `base`)
//   GET ?v=<rowId>                one video's plan ({} for a new one)
//   PUT ?v=<rowId> {doc, base}    save it (409 {stale, doc} when another device saved since `base`)
//   GET ?v=<rowId>&a=history      earlier copies        POST ?v=<rowId>&a=restore {ts}
import { getStore } from "@netlify/blobs";
import { isAdmin, json } from "../lib/session.mjs";
import { isPreviewHost } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { LIB, vKey, vHist, okId, loadLib, cleanLib, cleanVideo, keepCopy } from "../lib/studio.mjs";

let strongOk = true;
function sStore(name) {
  const strong = getStore({ name, consistency: "strong" }), plain = getStore(name);
  return { async get(k, o) { if (strongOk) { try { return await strong.get(k, o); } catch (e) { if (e && e.name === "BlobsConsistencyError") strongOk = false; else throw e; } } return plain.get(k, o); }, set: (k, v, o) => plain.set(k, v, o), setJSON: (k, v, o) => plain.setJSON(k, v, o), delete: (k) => plain.delete(k), list: (o) => plain.list(o) };
}
const out = (r) => new Response(r.body, { status: r.statusCode, headers: r.headers });

export default async (req) => {
  const u = new URL(req.url), q = Object.fromEntries(u.searchParams), m = req.method, event = { headers: Object.fromEntries(req.headers) };
  try {
    if (!isAdmin(event)) return out(json({ error: "Not signed in" }, 401));
    const preview = isPreviewHost(event), store = sStore(preview ? "site-content-dev" : "site-content"), backups = () => getStore(preview ? "site-backups-dev" : "site-backups");
    let b = {}; if (m !== "GET") { try { b = JSON.parse((await req.text()) || "{}") || {}; } catch { return out(json({ error: "Bad request" }, 400)); } }
    if (q.a === "lib") {
      const lib = await loadLib(store);
      if (m === "GET") return out(json(lib));
      if (m === "PUT") {
        if (b.base != null && +b.base < lib.rev) return out(json({ stale: true, lib }, 409));
        const c = cleanLib(b), next = { ...lib, ...c, rev: lib.rev + 1, updated: Date.now() };
        // a big drop in blocks keeps a copy of the old set first
        if (c.blocks.length < lib.blocks.length * 0.6) await store.setJSON(LIB + "-hist", [{ ts: Date.now(), lib }, ...(((await store.get(LIB + "-hist", { type: "json" })) ?? []).slice(0, 9))]);
        await store.setJSON(LIB, next); await maybeSnapshot(store, backups());
        return out(json({ ok: true, rev: next.rev }));
      }
    }
    if (q.v) {
      if (!okId(q.v)) return out(json({ error: "Not found" }, 404));
      if (q.a === "history") return out(json({ history: ((await store.get(vHist(q.v), { type: "json" })) ?? []).map((h) => ({ ts: h.ts, segs: (h.doc.segs || []).length })) }));
      const cur = (await store.get(vKey(q.v), { type: "json" })) ?? null;
      if (m === "GET") return out(json({ doc: cur || {}, rev: cur ? cur.rev : 0 }));
      if (m === "POST" && q.a === "restore") { const h = ((await store.get(vHist(q.v), { type: "json" })) ?? []).find((x) => x.ts === +b.ts); if (!h) return out(json({ error: "Not found" }, 404)); if (cur) await keepCopy(store, q.v, cur, true); const doc = { ...h.doc, rev: (cur ? cur.rev : 0) + 1, updated: Date.now() }; await store.setJSON(vKey(q.v), doc); return out(json({ ok: true, doc })); }
      if (m === "PUT") {
        if (cur && b.base != null && +b.base < (cur.rev || 0) && !b.force) return out(json({ stale: true, doc: cur }, 409));
        const doc = { ...cleanVideo(b.doc || {}), rev: (cur ? cur.rev || 0 : 0) + 1, updated: Date.now() };
        if (cur) await keepCopy(store, q.v, cur, (cur.segs || []).length >= 4 && doc.segs.length < (cur.segs || []).length * 0.5);
        await store.setJSON(vKey(q.v), doc); await maybeSnapshot(store, backups());
        return out(json({ ok: true, rev: doc.rev, updated: doc.updated }));
      }
    }
    return out(json({ error: "Method not allowed" }, 405));
  } catch (e) {
    return out(json({ error: "Server error", detail: String(e?.message || e) }, 500));
  }
};
