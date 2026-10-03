// /api/photos  GET: anyone reads the photo list.   GET ?missing=1 (owner): stored photos that are not in the list.
//   POST (owner): upload one photo {full, thumb, caption, w, h, known:[{id,caption,w,h}]}, both base64 JPEG.
//   PUT  (owner): save order and captions {photos:[{id,caption,w,h}], remove:[id], restore:[id]}.
// GET ?dupes=1 (owner): groups of photos whose pictures are identical (the first of each group is the one to keep).
// Every write may carry gone:[id]: photos this owner deleted recently, so a lagging copy of the list cannot bring them back.
// The list is one blob that every upload rewrites. Blob reads can briefly lag a write, so a quick run of uploads could
// read an older list and drop the newest photos. The page therefore sends the list it already has ("known"), and the
// server keeps every photo either side knows about. Photos dropped before this fix can be put back with ?missing / restore.
import { connectLambda } from "@netlify/blobs";
import { randomBytes, createHash } from "node:crypto";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const MAX_PHOTOS = 120, MAX_FULL = 2_000_000, MAX_THUMB = 300_000;
const cap = (v) => String(v ?? "").trim().slice(0, 140);
const isJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); // Blobs wants a plain ArrayBuffer
const ID = /^[a-f0-9]{12}$/;
const dim = (v) => (Number.isInteger(+v) && +v > 0 && +v <= 20000 ? +v : undefined);
const entry = (p) => { const o = { id: String(p.id), caption: cap(p.caption) }; const w = dim(p.w), h = dim(p.h); if (w && h) { o.w = w; o.h = h; } return o; };
const pub = (list) => list.map(entry);
// Adds the photos the page knows about that the (possibly lagging) stored list is missing, in the page's order.
function withKnown(cur, known, skip = new Set()) {
  const have = new Set(cur.map((p) => p.id)), out = [...cur];
  for (const p of Array.isArray(known) ? known : []) if (p && ID.test(String(p.id)) && !have.has(String(p.id)) && !skip.has(String(p.id))) { have.add(String(p.id)); out.push(entry(p)); }
  return out;
}

// Read with strong consistency where the platform offers it (right after a write, a plain read can return the older copy).
async function readJSON(store, key) {
  try { return await store.get(key, { type: "json", consistency: "strong" }); } catch { return store.get(key, { type: "json" }); }
}
async function exists(store, key) {
  try { return !!(await store.get(key, { type: "arrayBuffer", consistency: "strong" })); } catch { return !!(await store.get(key, { type: "arrayBuffer" })); }
}
const idSet = (v) => new Set((Array.isArray(v) ? v : []).map(String).filter((id) => ID.test(id)).slice(0, 300));

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const saved = await readJSON(store, "photos");
    const list = Array.isArray(saved) ? saved : null;
    const m = event.httpMethod, q = event.queryStringParameters || {};

    if (m === "GET" && !q.missing && !q.dupes) return json({ photos: list ? pub(list) : null });
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    if (m === "GET" && q.dupes) {
      const groups = new Map();
      for (const p of list || []) {
        let buf = null; try { buf = await store.get(`photo-${p.id}-t`, { type: "arrayBuffer" }); } catch {}
        if (!buf) continue; const h = createHash("sha1").update(Buffer.from(buf)).digest("hex");
        groups.set(h, [...(groups.get(h) || []), p.id]);
      }
      return json({ dupes: [...groups.values()].filter((g) => g.length > 1) });
    }
    if (m === "GET") {
      const ids = new Set((list || []).map((p) => p.id)), gone = idSet(String(q.gone || "").split(",")), found = [];
      const { blobs } = await store.list({ prefix: "photo-" });
      for (const { key } of blobs) { const k = key.match(/^photo-([a-f0-9]{12})-t$/); if (k && !ids.has(k[1]) && !gone.has(k[1]) && (await exists(store, key))) found.push(k[1]); }
      return json({ missing: found });
    }
    const b = body(event);
    if (!b) return json({ error: "Bad JSON" }, 400);
    const gone = idSet(b.gone);
    const cur = (list || []).filter((p) => !gone.has(p.id));

    if (m === "POST") {
      if (cur.length >= MAX_PHOTOS) return json({ error: `Limit of ${MAX_PHOTOS} photos reached` }, 400);
      const full = Buffer.from(String(b.full || ""), "base64"), thumb = Buffer.from(String(b.thumb || ""), "base64");
      if (!isJpeg(full) || !isJpeg(thumb)) return json({ error: "Photos must be JPEG" }, 400);
      if (full.length > MAX_FULL || thumb.length > MAX_THUMB) return json({ error: "Photo is too large" }, 413);
      const id = randomBytes(6).toString("hex");
      await store.set(`photo-${id}-f`, ab(full));
      await store.set(`photo-${id}-t`, ab(thumb));
      const next = [...withKnown(cur, b.known, gone), entry({ id, caption: b.caption, w: b.w, h: b.h })];
      await store.setJSON("photos", next);
      return json({ ok: true, id, photos: pub(next) });
    }

    if (m === "PUT") {
      const remove = new Set([...(Array.isArray(b.remove) ? b.remove : []).map(String), ...gone]);
      const restore = [];
      for (const id of (Array.isArray(b.restore) ? b.restore : []).map(String).filter((id) => ID.test(id) && !remove.has(id)).slice(0, 60)) if (await exists(store, `photo-${id}-t`)) restore.push({ id, caption: "" });
      const all = withKnown(withKnown(cur, b.photos, remove), restore, remove);
      const byId = new Map(all.map((p) => [p.id, p]));
      const out = [], seen = new Set();
      // the page's order wins; photos only the stored list knows about follow, then restored ones
      for (const p of Array.isArray(b.photos) ? b.photos : []) {
        const id = String(p?.id ?? "");
        if (!byId.has(id) || seen.has(id) || remove.has(id)) continue;
        seen.add(id); out.push(entry({ ...byId.get(id), ...p, id }));
      }
      for (const p of all) if (!seen.has(p.id) && !remove.has(p.id)) { seen.add(p.id); out.push(p); }
      for (const id of (Array.isArray(b.remove) ? b.remove : []).map(String)) if (ID.test(id)) { await store.delete(`photo-${id}-f`); await store.delete(`photo-${id}-t`); }
      await store.setJSON("photos", out);
      return json({ ok: true, photos: pub(out) });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
