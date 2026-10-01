// /api/photos  GET: anyone reads the photo list.
//   POST (owner): upload one photo {full, thumb, caption}, both base64 JPEG.
//   PUT  (owner): save order and captions {photos:[{id,caption}], remove:[id]}.
import { connectLambda } from "@netlify/blobs";
import { randomBytes } from "node:crypto";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const MAX_PHOTOS = 120, MAX_FULL = 2_000_000, MAX_THUMB = 300_000;
const cap = (v) => String(v ?? "").trim().slice(0, 140);
const isJpeg = (b) => b.length > 4 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); // Blobs wants a plain ArrayBuffer
const pub = (list) => list.map(({ id, caption }) => ({ id, caption }));

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const saved = await store.get("photos", { type: "json" });
    const list = Array.isArray(saved) ? saved : null;
    const m = event.httpMethod;

    if (m === "GET") return json({ photos: list ? pub(list) : null });
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    const b = body(event);
    if (!b) return json({ error: "Bad JSON" }, 400);
    const cur = list || [];

    if (m === "POST") {
      if (cur.length >= MAX_PHOTOS) return json({ error: `Limit of ${MAX_PHOTOS} photos reached` }, 400);
      const full = Buffer.from(String(b.full || ""), "base64"), thumb = Buffer.from(String(b.thumb || ""), "base64");
      if (!isJpeg(full) || !isJpeg(thumb)) return json({ error: "Photos must be JPEG" }, 400);
      if (full.length > MAX_FULL || thumb.length > MAX_THUMB) return json({ error: "Photo is too large" }, 413);
      const id = randomBytes(6).toString("hex");
      await store.set(`photo-${id}-f`, ab(full));
      await store.set(`photo-${id}-t`, ab(thumb));
      const next = [...cur, { id, caption: cap(b.caption) }];
      await store.setJSON("photos", next);
      return json({ ok: true, id, photos: pub(next) });
    }

    if (m === "PUT") {
      const remove = new Set((Array.isArray(b.remove) ? b.remove : []).map(String));
      const byId = new Map(cur.map((p) => [p.id, p]));
      const out = [], seen = new Set();
      for (const p of Array.isArray(b.photos) ? b.photos : []) {
        const id = String(p?.id ?? "");
        if (!byId.has(id) || seen.has(id) || remove.has(id)) continue;
        seen.add(id); out.push({ id, caption: cap(p.caption) });
      }
      for (const p of cur) if (!seen.has(p.id) && !remove.has(p.id)) out.push(p); // never drop photos the page did not know about
      for (const id of remove) if (byId.has(id)) { await store.delete(`photo-${id}-f`); await store.delete(`photo-${id}-t`); }
      await store.setJSON("photos", out);
      return json({ ok: true, photos: pub(out) });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
