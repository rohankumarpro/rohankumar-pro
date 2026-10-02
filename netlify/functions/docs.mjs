// /api/docs
//   GET                   owner: every page (the index).  Visitors: only the pages published to the web.
//   GET ?id=<id>|?slug=   one page with its blocks (owner: any, visitors: published only)
//   GET ?id=<id>&a=history   owner: earlier versions
//   POST                  owner: {title?, parent?, icon?, blocks?, cover?}  creates a page
//   PUT ?id=<id>          owner: {title, icon, cover, parent, order, fav, pub, slug, desc, noindex, blocks, trashed, restore: <ts>}
//   DELETE ?id=<id>       owner: removes a page and everything inside it for good
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore, backupStore } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { loadIndex, createPage, updatePage, purge, publicMetas, metaOf, pageKey, histKey } from "../lib/docs.mjs";
import { pingIndexNow } from "../lib/indexnow.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event), admin = isAdmin(event), q = event.queryStringParameters || {}, m = event.httpMethod;
    if (m === "GET") {
      const all = await loadIndex(store);
      const id = q.id || (q.slug ? (all.find((x) => x.slug === q.slug) || {}).id : "");
      if (!id) return json({ pages: admin ? all.map(metaOf) : publicMetas(all) });
      const meta = all.find((x) => x.id === id);
      if (!meta || (!admin && (!meta.pub || meta.trashed))) return json({ error: "Not found" }, 404);
      if (q.a === "history") { if (!admin) return json({ error: "Not signed in" }, 401); return json({ history: (await store.get(histKey(id), { type: "json" })) ?? [] }); }
      const pg = (await store.get(pageKey(id), { type: "json" })) ?? { blocks: [] };
      return json({ page: metaOf(meta), blocks: pg.blocks || [] });
    }
    if (!admin) return json({ error: "Not signed in" }, 401);
    const b = body(event); if (!b) return json({ error: "Bad JSON" }, 400);
    if (m === "POST") { const r = await createPage(store, b); await maybeSnapshot(store, backupStore(event)); return json({ ok: true, page: metaOf(r.meta), blocks: r.blocks }); }
    if (m === "PUT") {
      if (b.restore) { // put an earlier version back
        const hist = (await store.get(histKey(q.id), { type: "json" })) ?? [], h = hist.find((x) => x.ts === +b.restore);
        if (!h) return json({ error: "That version no longer exists" }, 404);
        const r = await updatePage(store, q.id, { blocks: h.blocks, title: h.title }); return r ? json({ ok: true, page: metaOf(r.meta), blocks: r.blocks }) : json({ error: "Not found" }, 404);
      }
      const before = (await loadIndex(store)).find((x) => x.id === q.id);
      const r = await updatePage(store, q.id, b);
      if (!r) return json({ error: "Not found" }, 404);
      if (r.conflict) return json({ error: "This page was changed somewhere else", conflict: true, page: metaOf(r.current.meta), blocks: r.current.blocks }, 409);
      await maybeSnapshot(store, backupStore(event));
      if ((r.meta.pub || before?.pub) && !r.meta.noindex) await pingIndexNow(event, [`/docs/${r.meta.slug}`, "/docs", "/sitemap.xml"]);
      return json({ ok: true, page: metaOf(r.meta), blocks: r.blocks || undefined });
    }
    if (m === "DELETE") return (await purge(store, q.id, backupStore(event))) ? json({ ok: true }) : json({ error: "Not found" }, 404);
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    if (e.code) return json({ error: e.msg }, e.code);
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
