// /api/boards   Owner only. Private infinite canvases.
//   GET                          the list of boards
//   GET ?id=<id>                 one board: {board, doc:{items, links, updated}}
//   GET ?id=<id>&a=history       earlier copies of a board (times and item counts)
//   GET ?page=<itemId>           the writing inside a page card: {blocks, updated}
//   GET ?page=<itemId>&a=history earlier versions of that writing
//   GET ?a=link&url=<url>        a preview of a web address (title, picture, site)
//   POST {title?, icon?, cover?, items?, links?}       new board
//   POST ?id=<id>&a=patch {up, del, lup, ldel, meta?}  change items and connectors
//   POST ?id=<id>&a=restore {ts}                       put an earlier copy of a board back (what is there now is kept first)
//   POST ?a=copypage {from, to}                        copy the writing of one page card into another
//   PUT ?id=<id> {title, icon, cover, order, fav, trashed, preview}
//   PUT ?page=<itemId> {blocks, base, title?, force?}
//   DELETE ?id=<id>              removes a board for good (a copy is kept in the backup store)
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore, backupStore } from "../lib/store.mjs";
import { maybeSnapshot } from "../lib/snapshots.mjs";
import { loadIndex, metaOf, createBoard, loadBoard, updateMeta, patchBoard, purgeBoard, loadPage, savePage, unfurl, okId, histKey, pageHistKey, pageKey, boardKey } from "../lib/boards.mjs";

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event), q = event.queryStringParameters || {}, m = event.httpMethod;
    if (q.id && !okId(q.id)) return json({ error: "Not found" }, 404);
    if (q.page && !okId(q.page)) return json({ error: "Not found" }, 404);

    if (m === "GET") {
      if (q.a === "link") { const r = await unfurl(q.url || ""); return r ? json(r) : json({ error: "That address can't be previewed" }, 400); }
      if (q.page) {
        if (q.a === "history") return json({ history: (await store.get(pageHistKey(q.page), { type: "json" })) ?? [] });
        const p = await loadPage(store, q.page); return json({ blocks: p.blocks || [], updated: p.updated || 0 });
      }
      const all = await loadIndex(store);
      if (!q.id) return json({ boards: all.map(metaOf) });
      const meta = all.find((x) => x.id === q.id); if (!meta) return json({ error: "Not found" }, 404);
      if (q.a === "history") { const h = (await store.get(histKey(q.id), { type: "json" })) ?? []; return json({ history: h.map((x) => ({ ts: x.ts, count: Object.keys(x.items || {}).length })) }); }
      const doc = await loadBoard(store, q.id);
      return json({ board: metaOf(meta), doc: { items: doc.items || {}, links: doc.links || {}, updated: doc.updated || 0 } });
    }

    const b = body(event); if (!b) return json({ error: "Bad JSON" }, 400);
    if (m === "POST") {
      if (q.a === "patch") {
        const r = await patchBoard(store, q.id, b); if (!r) return json({ error: "Not found" }, 404);
        await maybeSnapshot(store, backupStore(event));
        return json({ ok: true, board: metaOf(r.meta), updated: r.updated });
      }
      if (q.a === "restore") {
        const h = ((await store.get(histKey(q.id), { type: "json" })) ?? []).find((x) => x.ts === +b.ts);
        if (!h) return json({ error: "That copy no longer exists" }, 404);
        const cur = await loadBoard(store, q.id);
        const del = Object.keys(cur.items || {}).filter((k) => !h.items[k]), ldel = Object.keys(cur.links || {}).filter((k) => !h.links[k]);
        const r = await patchBoard(store, q.id, { up: Object.values(h.items), lup: Object.values(h.links || {}), del, ldel }); if (!r) return json({ error: "Not found" }, 404);
        const doc = await loadBoard(store, q.id);
        return json({ ok: true, board: metaOf(r.meta), doc: { items: doc.items, links: doc.links, updated: doc.updated } });
      }
      if (q.a === "copypage") {
        if (!okId(b.from) || !okId(b.to)) return json({ error: "Bad page" }, 400);
        const src = await store.get(pageKey(b.from), { type: "json" });
        if (src) await store.setJSON(pageKey(b.to), { id: b.to, blocks: src.blocks || [], updated: Date.now() });
        return json({ ok: true });
      }
      const r = await createBoard(store, b);
      await maybeSnapshot(store, backupStore(event));
      return json({ ok: true, board: metaOf(r.meta), doc: { items: r.doc.items, links: r.doc.links, updated: r.doc.updated } });
    }
    if (m === "PUT") {
      if (q.page) {
        const r = await savePage(store, q.page, b);
        if (r.conflict) return json({ error: "This page was changed somewhere else", conflict: true, blocks: r.current.blocks || [], updated: r.current.updated }, 409);
        await maybeSnapshot(store, backupStore(event));
        return json({ ok: true, updated: r.doc.updated, words: r.words, snip: r.snip });
      }
      const r = await updateMeta(store, q.id, b); return r ? json({ ok: true, board: metaOf(r) }) : json({ error: "Not found" }, 404);
    }
    if (m === "DELETE") {
      if (!(await store.get(boardKey(q.id), { type: "json" })) && !(await loadIndex(store)).some((x) => x.id === q.id)) return json({ error: "Not found" }, 404);
      return (await purgeBoard(store, q.id, backupStore(event))) ? json({ ok: true }) : json({ error: "Not found" }, 404);
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    if (e.code) return json({ error: e.msg }, e.code);
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
