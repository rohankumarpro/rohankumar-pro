// /api/photos  GET: anyone reads the photo list.
//   POST {thumb, full, caption} (base64 JPEG): owner adds a photo.
//   PUT {photos:[{id,caption}], remove:[id]}: owner reorders, captions and removes.
// Images are stored as blobs and served by /api/photo.
import { connectLambda, getStore } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";

const pub = (l) => l.map((p) => ({ id: p.id, caption: p.caption }));
const b64ok = (s) => typeof s === "string" && s.length > 0 && s.length < 5_500_000 && /^[A-Za-z0-9+/=]+$/.test(s);

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore("site-content");
    const m = event.httpMethod;
    const list = (await store.get("photos", { type: "json" })) ?? null;
    if (m === "GET") return json({ photos: list ? pub(list) : null });
    if (!["POST", "PUT"].includes(m)) return json({ error: "Method not allowed" }, 405);
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    const b = body(event);
    if (!b) return json({ error: "Bad JSON" }, 400);
    const cur = list ?? [];

    if (m === "POST") {
      if (!b64ok(b.thumb) || !b64ok(b.full)) return json({ error: "Bad image" }, 400);
      if (cur.length >= 200) return json({ error: "Too many photos" }, 400);
      const id = Math.random().toString(16).slice(2, 14).padEnd(12, "0");
      await store.set(`photo-${id}-t`, Buffer.from(b.thumb, "base64"));
      await store.set(`photo-${id}-f`, Buffer.from(b.full, "base64"));
      const next = cur.concat([{ id, caption: String(b.caption ?? "").slice(0, 140) }]);
      await store.setJSON("photos", next);
      return json({ ok: true, id, photos: pub(next) });
    }

    const rm = new Set((Array.isArray(b.remove) ? b.remove : []).map(String));
    const by = new Map(cur.map((p) => [p.id, p]));
    const out = [];
    (Array.isArray(b.photos) ? b.photos : []).forEach((p) => {
      const o = by.get(String(p?.id));
      if (o && !rm.has(o.id) && !out.find((x) => x.id === o.id)) {
        out.push({ id: o.id, caption: String(p.caption ?? "").slice(0, 140) });
      }
    });
    cur.forEach((p) => { if (!rm.has(p.id) && !out.find((x) => x.id === p.id)) out.push(p); });
    await store.setJSON("photos", out);
    await Promise.all(cur.filter((p) => rm.has(p.id)).flatMap((p) =>
      [store.delete(`photo-${p.id}-t`), store.delete(`photo-${p.id}-f`)]));
    return json({ ok: true, photos: pub(out) });
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
