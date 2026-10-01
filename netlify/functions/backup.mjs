// /api/backup   Owner only.
//   GET           -> one JSON file with everything written in Owner mode: settings, journal, notes, projects, links, docs,
//                    guestbook, messages from visitors, subscribers, vault (still encrypted) and the earlier version of each.
//                    Pictures and files are not inside it (they are kept as they are and listed by name).
//   POST {data}   -> puts a backup back. Existing items with the same name are replaced; nothing else is deleted.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const BINARY = /^(photo-|up-|vault-file-)/;
const SAFE_KEY = /^[\w\-./]{1,160}$/;

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event);
    if (event.httpMethod === "GET") {
      const { blobs } = await store.list();
      const data = {}, files = [];
      await Promise.all(blobs.map(async ({ key }) => {
        if (BINARY.test(key)) { files.push(key); return; }
        try { const v = await store.get(key, { type: "json" }); if (v != null) data[key] = v; } catch {}
      }));
      return json({ kind: "rohankumar-pro-backup", v: 1, ts: Date.now(), count: Object.keys(data).length, data, files: files.sort() },
        200, { "content-disposition": `attachment; filename="backup-${new Date().toISOString().slice(0, 10)}.json"` });
    }
    if (event.httpMethod === "POST") {
      const b = body(event);
      if (b?.kind !== "rohankumar-pro-backup" || typeof b.data !== "object" || !b.data) return json({ error: "That isn't a backup file from this site" }, 400);
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
