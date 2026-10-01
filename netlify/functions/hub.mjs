// /api/hub  The Links hub.
//   GET                visitors: the hub as they should see it now.  Owner: everything.
//   PUT {hub}          owner
//   POST ?a=view|click|subscribe   anyone (limited per address)
//   GET ?a=stats|subs  owner         DELETE ?a=sub&email=  owner
//   GET ?a=vcard       anyone: the "save contact" file
import { createHash } from "node:crypto";
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";
import { cleanHub, defaultHub, publicHub, vcardText } from "../lib/hub.mjs";

const day = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
async function tooMany(store, event, tag, max) {
  const h = event.headers || {};
  const ip = h["x-nf-client-connection-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "unknown";
  const key = `rl-${tag}-${createHash("sha256").update(ip).digest("hex").slice(0, 12)}-${new Date().toISOString().slice(0, 13)}`;
  const n = Number(await store.get(key)) || 0;
  if (n >= max) return true;
  await store.set(key, String(n + 1));
  return false;
}
export async function loadHub(store) {
  const saved = await store.get("hub", { type: "json" });
  if (saved) return saved;
  return defaultHub((await store.get("settings", { type: "json" })) ?? {});
}
const emptyStats = () => ({ views: 0, clicks: 0, items: {}, days: {}, refs: {}, dev: { m: 0, d: 0 } });

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event), admin = isAdmin(event), q = event.queryStringParameters || {}, m = event.httpMethod;

    if (m === "GET" && q.a === "vcard") {
      const hub = await loadHub(store);
      if (!hub.settings?.vcard || !hub.vcard?.name) return { statusCode: 404, body: "Not found" };
      return { statusCode: 200, headers: { "content-type": "text/vcard; charset=utf-8", "content-disposition": 'attachment; filename="contact.vcf"' }, body: vcardText(hub.vcard, "https://rohankumar.pro/") };
    }
    if (m === "GET" && q.a === "stats") {
      if (!admin) return json({ error: "Not signed in" }, 401);
      return json({ stats: (await store.get("hub-stats", { type: "json" })) ?? emptyStats() });
    }
    if (m === "GET" && q.a === "subs") {
      if (!admin) return json({ error: "Not signed in" }, 401);
      return json({ subs: (await store.get("hub-subs", { type: "json" })) ?? [] });
    }
    if (m === "GET") {
      const hub = await loadHub(store);
      return json({ hub: admin ? hub : publicHub(hub), saved: !!(await store.get("hub", { type: "json" })) });
    }

    if (m === "POST") {
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      if (q.a === "subscribe") {
        const email = String(b.email || "").trim().toLowerCase().slice(0, 120);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return json({ error: "That email does not look right." }, 400);
        if (b.website) return json({ ok: true });
        if (await tooMany(store, event, "sub", 5)) return json({ error: "Too many tries. Please try again later." }, 429);
        const subs = (await store.get("hub-subs", { type: "json" })) ?? [];
        if (subs.length >= 5000) return json({ error: "The list is full." }, 429);
        if (!subs.some((s) => s.email === email)) { subs.push({ email, name: String(b.name || "").slice(0, 60), ts: Date.now() }); await store.setJSON("hub-subs", subs); }
        return json({ ok: true });
      }
      if (q.a === "view" || q.a === "click") {
        if (admin) return json({ ok: true, skipped: true }); // the owner's own visits don't count
        if (await tooMany(store, event, "hub", 200)) return json({ ok: true });
        const st = (await store.get("hub-stats", { type: "json" })) ?? emptyStats(), d = day();
        st.days[d] = st.days[d] || { v: 0, c: 0 };
        if (q.a === "view") {
          st.views++; st.days[d].v++;
          const ref = String(b.ref || "").replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "").slice(0, 60);
          if (ref && !/rohankumar\.pro$/.test(ref)) st.refs[ref] = (st.refs[ref] || 0) + 1;
          if (b.mobile) st.dev.m++; else st.dev.d++;
        } else {
          const id = String(b.id || "").replace(/[^\w-]/g, "").slice(0, 16); if (!id) return json({ error: "Bad request" }, 400);
          st.clicks++; st.days[d].c++; st.items[id] = (st.items[id] || 0) + 1;
        }
        for (const k of Object.keys(st.days).sort().slice(0, -90)) delete st.days[k];
        const refs = Object.entries(st.refs).sort((a, c) => c[1] - a[1]).slice(0, 30); st.refs = Object.fromEntries(refs);
        await store.setJSON("hub-stats", st);
        return json({ ok: true });
      }
      return json({ error: "Bad request" }, 400);
    }

    if (!admin) return json({ error: "Not signed in" }, 401);
    if (m === "PUT") {
      const b = body(event);
      if (!b?.hub) return json({ error: "Bad JSON" }, 400);
      const hub = cleanHub(b.hub);
      if (JSON.stringify(hub).length > 900000) return json({ error: "Too large" }, 413);
      await store.setJSON("hub", hub);
      return json({ ok: true, hub });
    }
    if (m === "DELETE" && q.a === "sub") {
      const subs = ((await store.get("hub-subs", { type: "json" })) ?? []).filter((s) => s.email !== String(q.email || "").toLowerCase());
      await store.setJSON("hub-subs", subs);
      return json({ ok: true, subs });
    }
    if (m === "DELETE" && q.a === "stats") { await store.setJSON("hub-stats", emptyStats()); return json({ ok: true }); }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
