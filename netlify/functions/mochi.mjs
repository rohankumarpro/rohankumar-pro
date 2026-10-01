// /api/mochi  POST: a visitor's chat answer is recorded (anyone).  GET / DELETE ?vid=: only the signed-in owner.
import { connectLambda, getStore } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore("site-content");
    const all = (await store.get("mochi", { type: "json" })) ?? {};
    const m = event.httpMethod;

    if (m === "POST") {
      const b = body(event);
      if (!b || !/^[a-z0-9]{10,32}$/.test(b.vid || "") || !b.q || !b.a) return json({ error: "Bad request" }, 400);
      if (!all[b.vid] && Object.keys(all).length >= 2000) return json({ error: "Full" }, 429);
      const v = all[b.vid] ?? { vid: b.vid, name: "", email: "", answers: [] };
      if (b.name) v.name = String(b.name).slice(0, 40);
      if (/email$/.test(String(b.q))) {
        const e = String(b.a).match(/[^\s@]+@[^\s@]+\.[^\s@]{2,}/);
        if (e) v.email = e[0].slice(0, 120);
      }
      v.answers = v.answers.concat([{ q: String(b.q).slice(0, 40), a: String(b.a).slice(0, 500), t: Date.now() }]).slice(-80);
      v.updated = Date.now();
      all[b.vid] = v;
      await store.setJSON("mochi", all);
      return json({ ok: true });
    }

    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    if (m === "GET") {
      return json({ visitors: Object.values(all).sort((x, y) => (y.updated || 0) - (x.updated || 0)) });
    }
    if (m === "DELETE") {
      delete all[(event.queryStringParameters || {}).vid];
      await store.setJSON("mochi", all);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
