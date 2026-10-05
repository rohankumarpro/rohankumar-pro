// /api/contact  The Messages app: a contact form. Not anonymous: name and email are required, and each message keeps its details.
//   POST   anyone: send a message {name, email, phone, company, topic, budget, when, msg, tz, lang, ref, vid}.
//   GET    owner: every message, newest first.
//   PUT    owner: {id, status: "new" | "read" | "done"}
//   DELETE owner: ?id=<id>
// Each message is its own blob ("contact/<id>"), so two people sending at once can never overwrite each other.
// Optional email alerts: set RESEND_API_KEY and OWNER_EMAIL in Netlify (MOCHI_FROM is optional).
import { createHash } from "node:crypto";
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";

const PREFIX = "contact/", MAX = 2000, DAY = 86_400_000;
const TOPICS = ["project", "job", "collab", "question", "other"];
const STATUS = ["new", "read", "done"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const hash = (s) => createHash("sha256").update("rk-ct:" + s).digest("hex").slice(0, 16);

async function all(store) {
  const { blobs } = await store.list({ prefix: PREFIX });
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean);
}

// where the message came from, as Netlify sees it (country and city only, never the address itself)
function place(h) {
  const out = { country: clean(h["x-country"], 4) };
  try {
    const g = JSON.parse(Buffer.from(String(h["x-nf-geo"] || ""), "base64").toString("utf8"));
    if (g?.city) out.city = clean(g.city, 60);
    if (g?.country?.name) out.countryName = clean(g.country.name, 60);
    if (g?.country?.code) out.country = clean(g.country.code, 4);
  } catch {}
  return out;
}

async function alertOwner(m) {
  const key = process.env.RESEND_API_KEY, to = process.env.OWNER_EMAIL;
  if (!key || !to) return;
  const lines = [
    `From: ${m.name} <${m.email}>`, m.phone && `Phone: ${m.phone}`, m.company && `Company: ${m.company}`,
    `About: ${m.topic}`, m.budget && `Budget: ${m.budget}`, m.when && `Timeline: ${m.when}`, "", m.msg, "",
    "Sign in to your site and open Messages to see every message.",
  ].filter((x) => typeof x === "string");
  try {
    await Promise.race([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from: process.env.MOCHI_FROM || "Website <onboarding@resend.dev>", to: [to], reply_to: m.email, subject: `New message from ${m.name}`, text: lines.join("\n") }),
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
      if (b.website) return json({ ok: true }); // hidden field only bots fill in: pretend it worked
      const name = clean(b.name, 80), email = clean(b.email, 120), msg = clean(b.msg, 3000);
      if (!name) return json({ error: "Please add your name" }, 400);
      if (!EMAIL.test(email)) return json({ error: "Please add an email address I can reply to" }, 400);
      if (msg.length < 2) return json({ error: "Please write a message" }, 400);
      const h = event.headers || {};
      const ip = hash(h["x-nf-client-connection-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "");
      const list = await all(store), recent = list.filter((e) => Date.now() - e.ts < DAY);
      if (recent.filter((e) => e.ip === ip).length >= 6 || recent.filter((e) => e.email === email.toLowerCase()).length >= 4)
        return json({ error: "That's a lot of messages for one day. Please try again tomorrow, or email me." }, 429);
      if (list.length >= MAX) return json({ error: "The inbox is full. Please email me instead." }, 429);
      const entry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        ts: Date.now(), status: "new",
        name, email: email.toLowerCase(), msg,
        topic: TOPICS.includes(b.topic) ? b.topic : "other",
        phone: clean(b.phone, 30), company: clean(b.company, 80), budget: clean(b.budget, 40), when: clean(b.when, 40),
        // details recorded with every message
        tz: clean(b.tz, 60), lang: clean(b.lang, 20), ref: clean(b.ref, 200), page: clean(b.page, 200),
        ua: clean(h["user-agent"], 200), ...place(h), ip, vid: /^[a-z0-9]{10,32}$/.test(b.vid || "") ? b.vid : "",
      };
      for (const k of Object.keys(entry)) if (entry[k] === "") delete entry[k];
      await store.setJSON(PREFIX + entry.id, entry);
      await alertOwner(entry);
      return json({ ok: true, id: entry.id });
    }

    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);

    if (m === "GET") {
      const list = (await all(store)).sort((a, b) => b.ts - a.ts);
      return json({ messages: list });
    }
    if (m === "PUT") {
      const b = body(event) || {}, id = String(b.id || "");
      if (!/^[a-z0-9]{6,30}$/.test(id) || !STATUS.includes(b.status)) return json({ error: "Bad request" }, 400);
      const e = await store.get(PREFIX + id, { type: "json" });
      if (!e) return json({ error: "Not found" }, 404);
      await store.setJSON(PREFIX + id, { ...e, status: b.status });
      return json({ ok: true });
    }
    if (m === "DELETE") {
      const id = String(event.queryStringParameters?.id || "");
      if (!/^[a-z0-9]{6,30}$/.test(id)) return json({ error: "Bad request" }, 400);
      await store.delete(PREFIX + id);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
