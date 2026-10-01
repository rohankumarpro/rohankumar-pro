// /api/upload  Owner only. The pictures and small files used in articles, projects, links and notes.
//   GET                 -> {items}                the media library
//   POST {full, thumb?, name, w?, h?}   (base64)  -> {id, url, thumb}
//   DELETE ?id=<id>
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";
import { kindOf, upKey, newId } from "../lib/media-store.mjs";

const MAX = 4_600_000; // base64 characters in one request (the platform limit is 6 MB)
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const store = contentStore(event);
    const idx = (await store.get("uploads", { type: "json" })) ?? [];
    const m = event.httpMethod;
    if (m === "GET") return json({ items: idx });
    if (m === "POST") {
      const b = body(event);
      if (!b || typeof b.full !== "string" || !B64.test(b.full) || b.full.length + (b.thumb?.length || 0) > MAX) return json({ error: "Bad or too large file" }, 400);
      const full = Buffer.from(b.full, "base64"), k = kindOf(full);
      if (!k) return json({ error: "Only JPEG, PNG, WebP, GIF and PDF files are allowed" }, 400);
      if (idx.length >= 2000) return json({ error: "The media library is full" }, 400);
      const id = newId();
      await store.set(upKey(id), full);
      let hasThumb = false;
      if (k.image && typeof b.thumb === "string" && B64.test(b.thumb)) {
        const t = Buffer.from(b.thumb, "base64");
        if (kindOf(t)?.image) { await store.set(upKey(id, true), t); hasThumb = true; }
      }
      const item = { id, ext: k.ext, kind: k.image ? "image" : "file", name: String(b.name || "").slice(0, 120), bytes: full.length, w: Math.min(20000, +b.w || 0), h: Math.min(20000, +b.h || 0), thumb: hasThumb, ts: Date.now() };
      await store.setJSON("uploads", [item, ...idx]);
      return json({ ok: true, item, url: `/u/${id}.${k.ext}`, thumb: hasThumb ? `/u/${id}-t.${k.ext}` : `/u/${id}.${k.ext}` });
    }
    if (m === "DELETE") {
      const id = (event.queryStringParameters || {}).id;
      const it = idx.find((x) => x.id === id);
      if (!it) return json({ error: "Not found" }, 404);
      await store.delete(upKey(id)); await store.delete(upKey(id, true));
      await store.setJSON("uploads", idx.filter((x) => x.id !== id));
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
