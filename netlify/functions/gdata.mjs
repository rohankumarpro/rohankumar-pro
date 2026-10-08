// /api/gdata   Owner only. What the Planner shows from Google: calendar events, important email, subscriptions found
// in receipts. Read from a copy kept on the server (refreshed every 30 minutes, or when it is older than 10 when asked).
//   GET [?fresh=1]                    {cal, mail, subs, prefs, ts}
//   POST ?a=event {acct, cal, t, s, e, allDay, loc, desc, tz}    a new event in Google Calendar
//   PUT  ?a=event {acct, cal, id, …}  change an event        DELETE ?a=event&acct=&cal=&id=   remove an event you made
//   POST ?a=seen {id}                 take an email off the digest
//   POST ?a=scan                      read more receipts (call again while it says more: true)
//   POST ?a=nosub {key}               a suggested subscription that isn't one
//   PUT  ?a=prefs {vip, days}         who always counts as important, and how far back to look
// Preview addresses only read the copy; they never call Google.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore, isPreviewHost } from "../lib/store.mjs";
import { accounts, refresh, g, SCOPES, CAL, MAIL, SEEN, PREFS, SUBS_RAW, SUBS_NO, eventBody, suggestions } from "../lib/gapi.mjs";

const STALE = 10 * 60e3;
export const handler = async (event) => {
  try {
    if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
    connectLambda(event);
    const q = event.queryStringParameters || {}, m = event.httpMethod, store = contentStore(event), preview = isPreviewHost(event), b = m === "GET" ? {} : body(event) || {};
    const read = async (k, d) => (await store.get(k, { type: "json" })) ?? d;
    if (m === "GET") {
      let cal = await read(CAL, null), mail = await read(MAIL, null);
      const accts = await accounts(store);
      if (!preview && accts.length && (q.fresh || !cal || !mail || Date.now() - cal.ts > STALE || Date.now() - mail.ts > STALE)) { const r = await refresh(store, { budgetMs: 7000 }); cal = r.cal || cal; mail = r.mail || mail; }
      const seen = new Set(await read(SEEN, [])), raw = await read(SUBS_RAW, {}), no = await read(SUBS_NO, []);
      if (mail) for (const a of Object.values(mail.accounts || {})) if (a.msgs) a.msgs = a.msgs.filter((x) => !seen.has(x.id));
      return json({ preview, accounts: accts.map(({ id, email, kind, color, cal, mail }) => ({ id, email, kind, color, cal: cal !== false, mail: mail !== false })), cal, mail, subs: suggestions(raw, no), scan: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { n: v.n, done: !!v.done }])), prefs: await read(PREFS, {}) });
    }
    if (q.a === "seen" && m === "POST") { const s = await read(SEEN, []); if (b.id) await store.setJSON(SEEN, [String(b.id).slice(0, 40), ...s.filter((x) => x !== b.id)].slice(0, 2000)); return json({ ok: true }); }
    if (q.a === "nosub" && m === "POST") { const s = await read(SUBS_NO, []); if (b.key) await store.setJSON(SUBS_NO, [...new Set([String(b.key).slice(0, 60), ...s])].slice(0, 500)); return json({ ok: true }); }
    if (q.a === "prefs" && m === "PUT") { const p = await read(PREFS, {}); if (Array.isArray(b.vip)) p.vip = b.vip.map((x) => String(x).trim().toLowerCase().slice(0, 120)).filter(Boolean).slice(0, 30); if (b.days) p.days = Math.max(1, Math.min(30, +b.days || 7)); await store.setJSON(PREFS, p); return json({ ok: true, prefs: p }); }
    if (preview) return json({ error: "Preview addresses don't talk to Google. Try this on the live site." }, 400);
    if (q.a === "scan" && m === "POST") {
      const r = await refresh(store, { budgetMs: 8000, cal: false, mail: false, subs: true });
      const raw = await read(SUBS_RAW, {}), no = await read(SUBS_NO, []);
      return json({ ...r.subs, more: Object.values(r.subs.progress).some((p) => !p.done) && !Object.keys(r.subs.errors).length, subs: suggestions(raw, no) });
    }
    if (q.a === "event") {
      const accts = await accounts(store), a = accts.find((x) => x.id === (b.acct || q.acct)); if (!a) return json({ error: "That Google account isn't connected" }, 400);
      const cal = encodeURIComponent(b.cal || q.cal || "primary"), base = `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`;
      let ev = null;
      if (m === "POST") ev = await g(store, a, SCOPES.cal, base, { method: "POST", body: JSON.stringify(eventBody(b)) });
      else if (m === "PUT") ev = await g(store, a, SCOPES.cal, `${base}/${encodeURIComponent(b.id)}`, { method: "PATCH", body: JSON.stringify(eventBody(b)) });
      else if (m === "DELETE") await g(store, a, SCOPES.cal, `${base}/${encodeURIComponent(q.id)}`, { method: "DELETE" });
      else return json({ error: "Method not allowed" }, 405);
      await refresh(store, { budgetMs: 5000, mail: false });
      return json({ ok: true, id: ev && ev.id, link: ev && ev.htmlLink });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: String(e?.message || e).slice(0, 400) }, e.status && e.status < 500 ? 400 : 500);
  }
};
