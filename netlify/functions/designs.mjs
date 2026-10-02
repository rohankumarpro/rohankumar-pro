// /api/designs   Owner only, except ?view=<token> (a deck the owner shared with a private link).
//   GET                          the list of designs
//   GET ?id=<id>                 one design: {design, doc:{nodes, slides, bg, updated, rev}}
//   GET ?id=<id>&a=history       earlier copies (times and layer counts)
//   GET ?view=<token>            anyone with the link: {title, slides, nodes} (view and present only)
//   POST {title?, nodes?, slides?, bg?}                 new design
//   POST ?id=<id>&a=patch {up, del, slides?, bg?, thumb?, base}   change layers (409 {stale} if the read was old)
//   POST ?id=<id>&a=patch {full, nodes, slides, bg, base}         the whole design, sent when a patch was refused as stale
//   POST ?id=<id>&a=restore {ts}                       put an earlier copy back (what is there now is kept first)
//   POST ?id=<id>&a=share {on}                         switch the private link on or off
//   PUT ?id=<id> {title, order, trashed}
//   PUT ?a=order {ids}
//   DELETE ?id=<id>              removes a design for good (a copy is kept in the backup store)
// A Functions 2.0 handler, so reads can be strongly consistent (a save never builds on an old copy).
import { getStore } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { isPreviewHost } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { designsStore, listDesigns, loadIndex, loadDesign, createDesign, updateMeta, reorder, patchDesign, setShare, publicView, purgeDesign, metaOf, histKey, okId } from "../lib/designs.mjs";

export default async (req) => {
  const u = new URL(req.url), raw = req.method === "GET" || req.method === "HEAD" ? "" : await req.text();
  const event = { httpMethod: req.method, headers: Object.fromEntries(req.headers), queryStringParameters: Object.fromEntries(u.searchParams), body: raw, isBase64Encoded: false };
  const r = await run(event);
  return new Response(r.body, { status: r.statusCode, headers: r.headers });
};

async function run(event) {
  try {
    const preview = isPreviewHost(event);
    const store = designsStore(preview ? "site-content-dev" : "site-content"), backups = () => getStore(preview ? "site-backups-dev" : "site-backups");
    const q = event.queryStringParameters || {}, m = event.httpMethod;
    // the one thing visitors can reach: a deck shared with its private link
    if (m === "GET" && q.view) {
      const v = await publicView(store, String(q.view));
      if (!v) return json({ error: "This link is not active" }, 404);
      const r = json(v); r.headers = { ...r.headers, "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" }; return r;
    }
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    if (q.id && !okId(q.id)) return json({ error: "Not found" }, 404);

    if (m === "GET") {
      if (!q.id) return json({ designs: (await listDesigns(store)).map(metaOf) });
      const meta = (await loadIndex(store)).find((x) => x.id === q.id); if (!meta) return json({ error: "Not found" }, 404);
      if (q.a === "history") { const h = (await store.get(histKey(q.id), { type: "json" })) ?? []; return json({ history: h.map((x) => ({ ts: x.ts, count: Object.keys(x.nodes || {}).length })) }); }
      const doc = await loadDesign(store, q.id);
      return json({ design: metaOf(meta), doc: { nodes: doc.nodes || {}, slides: doc.slides || [], bg: doc.bg || "#E9EBEE", sw: doc.sw || [], updated: doc.updated || 0, rev: doc.rev || 0 } });
    }
    const b = body(event); if (!b) return json({ error: "Bad JSON" }, 400);
    if (m === "POST") {
      if (q.a === "patch") {
        const r = await patchDesign(store, q.id, b); if (!r) return json({ error: "Not found" }, 404);
        if (r.stale) return json({ error: "Stale copy", stale: true, rev: r.rev }, 409);
        await maybeSnapshot(store, backups());
        return json({ ok: true, rev: r.rev, updated: r.updated });
      }
      if (q.a === "restore") {
        const h = ((await store.get(histKey(q.id), { type: "json" })) ?? []).find((x) => x.ts === +b.ts);
        if (!h) return json({ error: "That copy no longer exists" }, 404);
        const r = await patchDesign(store, q.id, { full: true, nodes: Object.values(h.nodes || {}), slides: h.slides || [], bg: h.bg }); if (!r) return json({ error: "Not found" }, 404);
        const doc = await loadDesign(store, q.id);
        return json({ ok: true, doc: { nodes: doc.nodes, slides: doc.slides, bg: doc.bg, updated: doc.updated, rev: doc.rev } });
      }
      if (q.a === "share") { const r = await setShare(store, q.id, !!b.on); return r ? json({ ok: true, design: metaOf(r) }) : json({ error: "Not found" }, 404); }
      const r = await createDesign(store, b);
      await maybeSnapshot(store, backups());
      return json({ ok: true, design: metaOf(r.meta), doc: { nodes: r.doc.nodes, slides: r.doc.slides, bg: r.doc.bg, updated: r.doc.updated, rev: r.doc.rev } });
    }
    if (m === "PUT") {
      if (q.a === "order") return json({ ok: true, designs: (await reorder(store, b.ids)).map(metaOf) });
      const r = await updateMeta(store, q.id, b); return r ? json({ ok: true, design: metaOf(r) }) : json({ error: "Not found" }, 404);
    }
    if (m === "DELETE") return (await purgeDesign(store, q.id, backups())) ? json({ ok: true }) : json({ error: "Not found" }, 404);
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    if (e.code) return json({ error: e.msg }, e.code);
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
}
