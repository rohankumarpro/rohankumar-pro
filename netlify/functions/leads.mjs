// /api/leads  Link lists unlocked with an email (the /repos page).
//   GET    ?list=repos         anyone: the list's names, notes and logos (no links).
//   POST   {list, email, news} anyone: saves the sign-up, emails the links (when Resend is set up) and returns them.
//   GET    ?a=all              owner: every sign-up, newest first.  ?a=all&format=csv  the same as a CSV file.
//   DELETE ?key=<key>          owner: remove one person (for example when they ask to be forgotten).
// Each sign-up is its own blob ("lead/<list>/<email hash>"), so two people signing up at once never overwrite each other,
// and the same person signing up twice updates their one record instead of adding a copy.
// Email to the visitor needs RESEND_API_KEY and MOCHI_FROM (an address on a domain verified in Resend).
import { createHash } from "node:crypto";
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";
import { LISTS, publicList } from "../lib/lead-lists.mjs";

const PREFIX = "lead/", RATE = "lead-rate", PER_IP_DAY = 12, GUIDES = "https://rohankumar.pro/repos";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KEY = /^lead\/[a-z0-9-]{1,30}\/[a-f0-9]{20}$/;
const clean = (s, n) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const hash = (s, n = 16) => createHash("sha256").update("rk-ld:" + s).digest("hex").slice(0, n);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

async function all(store) {
  const { blobs } = await store.list({ prefix: PREFIX });
  return (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).then((v) => v && { key: b.key, ...v }).catch(() => null)))).filter(Boolean);
}

// one small counter per day, so a script can't fill the store
async function overLimit(store, ip) {
  const day = new Date().toISOString().slice(0, 10);
  let r = (await store.get(RATE, { type: "json" }).catch(() => null)) || {};
  if (r.day !== day) r = { day, n: {} };
  r.n[ip] = (r.n[ip] || 0) + 1;
  await store.setJSON(RATE, r);
  return r.n[ip] > PER_IP_DAY;
}

async function sendLinks(to, L, news) {
  const key = process.env.RESEND_API_KEY, from = process.env.MOCHI_FROM;
  if (!key || !from) return false;
  const rows = [...L.items, ...(L.bonus || [])];
  const text = [
    `Here are the links you asked for: ${L.title}.`, "",
    ...rows.map((r, i) => `${i < L.items.length ? i + 1 + "." : "Bonus:"} ${r.name} (replaces ${r.replaces})\n   ${r.href}`), "",
    `Step-by-step install guides for each one: ${GUIDES}`, "",
    news ? "You're on the newsletter list too. Reply with \"unsubscribe\" any time to leave." : "That's all. You won't get other emails from me unless you ask.",
    "", "Rohan (Sansser)",
  ].join("\n");
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.5;color:#1A1C20;max-width:560px">
<p>Here are the links you asked for: <b>${esc(L.title)}</b>.</p><ol style="padding-left:20px">${L.items.map((r) => `<li style="margin:0 0 10px"><a href="${esc(r.href)}" style="color:#0B57D0;font-weight:600">${esc(r.name)}</a> replaces ${esc(r.replaces)}<br><span style="color:#454A55">${esc(r.note)}</span></li>`).join("")}</ol>
${(L.bonus || []).map((r) => `<p><b>Bonus:</b> <a href="${esc(r.href)}" style="color:#0B57D0;font-weight:600">${esc(r.name)}</a> replaces ${esc(r.replaces)}. ${esc(r.note)}.</p>`).join("")}
<p>Step-by-step install guides for each one: <a href="${GUIDES}" style="color:#0B57D0;font-weight:600">rohankumar.pro/repos</a></p>
<p style="color:#454A55">${news ? "You're on the newsletter list too. Reply with &ldquo;unsubscribe&rdquo; any time to leave." : "That's all. You won't get other emails from me unless you ask."}</p><p>Rohan (Sansser)</p></div>`;
  try {
    const r = await Promise.race([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject: `Your links: ${L.title}`, text, html }),
      }),
      new Promise((res) => setTimeout(() => res(null), 4000)),
    ]);
    return !!r?.ok;
  } catch { return false; }
}

const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const m = event.httpMethod, q = event.queryStringParameters || {};

    if (m === "GET" && q.list) {
      const L = publicList(String(q.list));
      return L ? json(L, 200, { "cache-control": "public, max-age=300" }) : json({ error: "Not found" }, 404);
    }

    if (m === "POST") {
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const L = LISTS[b.list];
      if (!L) return json({ error: "Not found" }, 404);
      if (b.website) return json({ ok: true, items: [], bonus: [] }); // hidden field only bots fill in
      const email = clean(b.email, 120).toLowerCase();
      if (!EMAIL.test(email)) return json({ error: "Please enter a valid email address" }, 400);
      const h = event.headers || {};
      const ip = hash(h["x-nf-client-connection-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "");
      if (await overLimit(store, ip)) return json({ error: "Too many tries from this connection today. Please try again tomorrow." }, 429);
      const key = `${PREFIX}${b.list}/${hash(email, 20)}`, now = Date.now(), news = b.news === true;
      const old = await store.get(key, { type: "json" }).catch(() => null);
      const entry = old
        ? { ...old, news: old.news || news, newsTs: old.news ? old.newsTs : news ? now : undefined, last: now, times: (old.times || 1) + 1 }
        : { list: b.list, email, news, ts: now, ...(news ? { newsTs: now } : {}), src: clean(b.src, 60) || L.from, ref: clean(b.ref, 200), tz: clean(b.tz, 60), lang: clean(b.lang, 20), country: clean(h["x-country"], 4), ip };
      for (const k of Object.keys(entry)) if (entry[k] === "" || entry[k] === undefined) delete entry[k];
      await store.setJSON(key, entry);
      const emailed = await sendLinks(email, L, entry.news);
      return json({ ok: true, emailed, items: L.items, bonus: L.bonus || [] });
    }

    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);

    if (m === "GET") {
      const list = (await all(store)).sort((a, b) => b.ts - a.ts);
      if (q.format === "csv") {
        const cols = ["email", "news", "list", "src", "ts", "newsTs", "times", "country", "ref"];
        const rows = list.map((e) => cols.map((c) => csvCell(c === "ts" || c === "newsTs" ? (e[c] ? new Date(e[c]).toISOString() : "") : c === "news" ? (e.news ? "yes" : "no") : e[c])).join(","));
        return { statusCode: 200, headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store", "content-disposition": `attachment; filename="signups-${new Date().toISOString().slice(0, 10)}.csv"` }, body: [cols.join(","), ...rows].join("\n") };
      }
      return json({ leads: list, total: list.length, news: list.filter((e) => e.news).length });
    }
    if (m === "DELETE") {
      const key = String(q.key || "");
      if (!KEY.test(key)) return json({ error: "Bad request" }, 400);
      await store.delete(key);
      return json({ ok: true });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
