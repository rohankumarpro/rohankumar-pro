// /api/mochi  What visitors tell Mochi.
//   POST (anyone): record one answer {vid, name, q, a}. Limited per visitor and per address.
//   GET  (owner only): read the inbox.   DELETE (owner only): ?vid=<id> removes one visitor.
// Optional email alerts: set RESEND_API_KEY and OWNER_EMAIL in Netlify (MOCHI_FROM is optional).
import { connectLambda } from "@netlify/blobs";
import { createHash } from "node:crypto";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const PREFIX = "mochi-v-", MAX_VISITORS = 500, PER_HOUR = 40, KEEP_ANSWERS = 80;
const str = (v, n) => String(v ?? "").trim().slice(0, n);
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;
const ALERT = new Set(["message", "question-for-rohan"]);

async function tooMany(store, event) {
  const h = event.headers || {};
  const ip = h["x-nf-client-connection-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "unknown";
  const key = `rl-${createHash("sha256").update(ip).digest("hex").slice(0, 16)}-${new Date().toISOString().slice(0, 13)}`;
  const n = Number(await store.get(key)) || 0;
  if (n >= PER_HOUR) return true;
  await store.set(key, String(n + 1));
  return false;
}

async function alertOwner(v, q, a) {
  const key = process.env.RESEND_API_KEY, to = process.env.OWNER_EMAIL;
  if (!key || !to) return;
  const text = `${v.name || "A visitor"}${v.email ? ` (${v.email})` : ""} told Mochi:\n\n${q}: ${a}\n\nSign in to your site and open Settings > Mochi's inbox to see everything.`;
  try {
    await Promise.race([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.MOCHI_FROM || "Mochi <onboarding@resend.dev>", to: [to], subject: "Mochi has a message for you", text }),
      }),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch {}
}

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const m = event.httpMethod;

    if (m === "POST") {
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const vid = String(b.vid || ""), q = str(b.q, 40), a = str(b.a, 500);
      if (!/^[a-z0-9]{10,32}$/.test(vid) || !q || !a) return json({ error: "Bad request" }, 400);
      if (await tooMany(store, event)) return json({ error: "Too many requests" }, 429);
      let v = await store.get(PREFIX + vid, { type: "json" });
      if (!v) {
        const { blobs } = await store.list({ prefix: PREFIX });
        if (blobs.length >= MAX_VISITORS) return json({ error: "Inbox is full" }, 429);
        v = { vid, name: "", email: "", answers: [], created: Date.now() };
      }
      const name = str(b.name, 40); if (name) v.name = name;
      if (q.endsWith("email")) { const e = a.match(EMAIL); if (e) v.email = e[0].slice(0, 120); }
      v.answers = [...v.answers, { q, a, t: Date.now() }].slice(-KEEP_ANSWERS);
      v.updated = Date.now();
      await store.setJSON(PREFIX + vid, v);
      if (ALERT.has(q) || q.endsWith("email")) await alertOwner(v, q, a);
      return json({ ok: true });
    }

    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);

    if (m === "GET") {
      const { blobs } = await store.list({ prefix: PREFIX });
      const all = (await Promise.all(blobs.slice(0, MAX_VISITORS).map((x) => store.get(x.key, { type: "json" })))).filter(Boolean);
      all.sort((x, y) => (y.updated || 0) - (x.updated || 0));
      return json({ visitors: all.slice(0, 100) });
    }
    if (m === "DELETE") {
      const vid = String(event.queryStringParameters?.vid || "");
      if (!/^[a-z0-9]{10,32}$/.test(vid)) return json({ error: "Bad request" }, 400);
      await store.delete(PREFIX + vid);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
