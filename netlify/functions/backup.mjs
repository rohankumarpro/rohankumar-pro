// /api/backup   Owner only.
//   GET           -> one JSON file with everything written in Owner mode: settings, journal, notes, projects, links, docs,
//                    guestbook, messages from visitors, subscribers, vault (still encrypted) and the earlier version of each.
//                    Pictures and files are not inside it (they are kept as they are and listed by name).
//   POST {data}   -> puts a backup back. Existing items with the same name are replaced; nothing else is deleted.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore, backupStore } from "../lib/store.mjs";
import { collect, listSnaps, takeSnapshot } from "../lib/snapshots.mjs";

const BINARY = /^(photo-|up-|vault-file-)/;
const SNAP_KEY = /^snap-[\w-]{1,60}$/;
const SAFE_KEY = /^[\w\-./]{1,160}$/;

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event);
    const q = event.queryStringParameters || {}, bk = backupStore(event);
    if (event.httpMethod === "GET") {
      if (q.a === "snaps") { const last = await bk.get("snap-latest", { type: "json" }).catch(() => null); return json({ snaps: await listSnaps(bk), last }); }
      if (q.snap) {
        if (!SNAP_KEY.test(q.snap)) return json({ error: "Bad name" }, 400);
        const v = await bk.get(q.snap, { type: "json" }); if (!v) return json({ error: "Not found" }, 404);
        return json(v, 200, { "content-disposition": `attachment; filename="${q.snap}.json"` });
      }
      const snap = await collect(store);
      return json(snap, 200, { "content-disposition": `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"` });
    }
    if (event.httpMethod === "POST") {
      if (q.a === "now") { const r = await takeSnapshot(store, bk); return json(r ? { ok: true, ...r } : { error: "Nothing to back up yet" }, r ? 200 : 400); }
      const b0 = body(event);
      const b = q.snap ? (SNAP_KEY.test(q.snap) ? await bk.get(q.snap, { type: "json" }) : null) : b0;
      if (b?.kind !== "rohankumar-pro-backup" || typeof b.data !== "object" || !b.data) return json({ error: "That isn't a backup file from this site" }, 400);
      try { await takeSnapshot(store, bk); } catch {} // keep what is there now before anything is put back
      let n = 0;
      for (const [key, value] of Object.entries(b.data)) {
        if (!SAFE_KEY.test(key) || BINARY.test(key) || value == null) continue;
        await store.setJSON(key, value); n++;
      }
      return json({ ok: true, restored: n });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
