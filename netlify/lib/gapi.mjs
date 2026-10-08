// Google Calendar and Gmail for the Planner, owner only.
// Two kinds of account:
//   "oauth"  any Google account (a personal Gmail too), connected once with "Sign in with Google" (see functions/gauth.mjs).
//            Needs GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Netlify. The login it gets back (a refresh
//            token) is encrypted here before it is stored, and never leaves the server.
//   "sa"     the Workspace address the Docs/Keep sync already acts as (gsync.mjs), when its delegation includes the
//            calendar and gmail.readonly scopes.
// Storage (new keys only):
//   gaccts          [{id, email, kind, added, cal, mail, color, cals?}]   the accounts and what each is used for
//   gacct-tok-<id>  {iv, c}            an encrypted refresh token (oauth accounts)
//   gcal-cache      {ts, accounts: {id: {email, error?, cals, events}}}
//   gmail-cache     {ts, accounts: {id: {email, error?, msgs}}}
//   gmail-seen      [msgId]            emails dismissed from the digest
//   gprefs          {vip: [email], days}
//   subs-raw        {acct: {cursor, done, n, items: {msgId: {d, m, a, c, s}}}}   receipts read so far
//   subs-dismissed  [key]              suggestions said no to
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import { saUser, saToken } from "./gsync.mjs";

export const ACCTS = "gaccts", CAL = "gcal-cache", MAIL = "gmail-cache", SEEN = "gmail-seen", PREFS = "gprefs", SUBS_RAW = "subs-raw", SUBS_NO = "subs-dismissed";
export const tokKey = (id) => `gacct-tok-${id}`;
export const SCOPES = { cal: "https://www.googleapis.com/auth/calendar", mail: "https://www.googleapis.com/auth/gmail.readonly" };
const env = (k) => String(process.env[k] || "").trim();
export const oauthReady = () => !!(env("GOOGLE_OAUTH_CLIENT_ID") && env("GOOGLE_OAUTH_CLIENT_SECRET"));
export const COLORS = ["#1A73E8", "#E8710A", "#188038", "#A142F4", "#D93025", "#12A4AF", "#F9AB00", "#C5221F"];

/* ---------- keeping the login secret ---------- */
const keyOf = () => createHmac("sha256", "rk-gapi-v1").update(env("ADMIN_PASSWORD") || "no-key").digest();
export function seal(text) { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", keyOf(), iv); const enc = Buffer.concat([c.update(String(text), "utf8"), c.final(), c.getAuthTag()]); return { iv: iv.toString("base64"), c: enc.toString("base64") }; }
export function unseal(o) { const buf = Buffer.from(o.c, "base64"), d = createDecipheriv("aes-256-gcm", keyOf(), Buffer.from(o.iv, "base64")); d.setAuthTag(buf.subarray(buf.length - 16)); return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]).toString("utf8"); }
// the "state" that goes to Google and back: proves the sign-in was started by the owner here, a short while ago
export function signState(o) { const p = Buffer.from(JSON.stringify({ ...o, t: Date.now() })).toString("base64url"); return p + "." + createHmac("sha256", keyOf()).update(p).digest("base64url"); }
export function readState(s) { const [p, sig] = String(s || "").split("."); if (!p || createHmac("sha256", keyOf()).update(p).digest("base64url") !== sig) return null; try { const o = JSON.parse(Buffer.from(p, "base64url").toString()); return Date.now() - o.t < 15 * 60e3 ? o : null; } catch { return null; } }

/* ---------- accounts ---------- */
export async function accounts(store) {
  const list = (await store.get(ACCTS, { type: "json" })) ?? [];
  const sa = saUser();
  if (sa && !list.some((a) => a.kind === "sa")) list.push({ id: "workspace", email: sa, kind: "sa", added: 0, cal: true, mail: true, color: COLORS[list.length % COLORS.length], auto: true });
  return list.filter((a) => a.kind !== "sa" || sa);
}
export async function saveAccounts(store, list) { await store.setJSON(ACCTS, list.map((a) => { const o = { ...a }; delete o.auto; return o; })); }

const tokens = new Map();
async function accessToken(store, a, scope) {
  if (a.kind === "sa") return saToken(scope);
  const k = a.id; const t = tokens.get(k); if (t && t.exp > Date.now() + 60e3) return t.v;
  const sealed = await store.get(tokKey(a.id), { type: "json" }); if (!sealed) throw Object.assign(new Error("This account needs to be connected again."), { code: "reauth" });
  let refresh; try { refresh = unseal(sealed); } catch { throw Object.assign(new Error("The saved Google login can't be read (was the site password changed?). Connect the account again."), { code: "reauth" }); }
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env("GOOGLE_OAUTH_CLIENT_ID"), client_secret: env("GOOGLE_OAUTH_CLIENT_SECRET"), refresh_token: refresh, grant_type: "refresh_token" }) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error === "invalid_grant" ? "Google ended this connection (it was removed, or the password changed). Connect the account again." : `Google sign-in failed (${d.error || r.status}).`), { code: d.error === "invalid_grant" ? "reauth" : "auth" });
  tokens.set(k, { v: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 });
  return d.access_token;
}
export async function g(store, a, scope, url, opt = {}) {
  const tok = await accessToken(store, a, a.kind === "sa" ? scope : "all");
  const r = await fetch(url, { ...opt, headers: { authorization: "Bearer " + tok, ...(opt.body && typeof opt.body === "string" ? { "content-type": "application/json" } : {}), ...(opt.headers || {}) } });
  if (r.status === 204) return null;
  const txt = await r.text(); let d = null; try { d = JSON.parse(txt); } catch {}
  if (!r.ok) {
    const msg = d?.error?.message || txt.slice(0, 200);
    const api = /gmail/.test(url) ? "Gmail" : "Google Calendar";
    const hint = /has not been used|is disabled/i.test(msg) ? ` Turn on the ${api} API in your Google Cloud project.` : r.status === 403 && /scope|insufficient|unauthorized/i.test(msg) ? (a.kind === "sa" ? ` Add the ${scope} scope to the domain-wide delegation in Google Admin.` : " Connect the account again and allow everything it asks for.") : "";
    throw Object.assign(new Error(`${api}: ${msg}.${hint}`), { status: r.status });
  }
  return d;
}

/* ---------- calendar ---------- */
const day = 864e5;
export async function readCalendars(store, a) {
  const list = await g(store, a, SCOPES.cal, "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=100");
  return (list.items || []).map((c) => ({ id: c.id, name: c.summaryOverride || c.summary || c.id, color: c.backgroundColor || "", primary: !!c.primary, write: ["owner", "writer"].includes(c.accessRole), on: a.cals ? a.cals.includes(c.id) : (c.selected !== false && !/#(holiday|contacts|weeknum)@/.test(c.id)) || !!c.primary }));
}
export async function readEvents(store, a, cals, { from = Date.now() - 35 * day, to = Date.now() + 120 * day } = {}) {
  const out = [];
  await Promise.all(cals.filter((c) => c.on).map(async (c) => {
    let pt = "", n = 0;
    do {
      const u = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?singleEvents=true&orderBy=startTime&maxResults=500&timeMin=${new Date(from).toISOString()}&timeMax=${new Date(to).toISOString()}${pt ? "&pageToken=" + pt : ""}`;
      const d = await g(store, a, SCOPES.cal, u); pt = d.nextPageToken || "";
      for (const e of d.items || []) {
        if (e.status === "cancelled") continue;
        const allDay = !!(e.start && e.start.date);
        out.push({ id: e.id, cal: c.id, acct: a.id, t: String(e.summary || "(No title)").slice(0, 200), s: allDay ? e.start.date : e.start?.dateTime, e: allDay ? e.end?.date : e.end?.dateTime, allDay, loc: String(e.location || "").slice(0, 200), link: e.htmlLink || "", meet: e.hangoutLink || "", color: c.color, write: c.write && (!e.organizer || e.organizer.self || c.write), desc: String(e.description || "").slice(0, 600) });
      }
    } while (pt && ++n < 4);
  }));
  return out.sort((x, y) => String(x.s).localeCompare(String(y.s)));
}
// an event made, changed or removed from the Planner
export function eventBody(b) {
  const o = { summary: String(b.t || "").slice(0, 300) };
  if (b.loc != null) o.location = String(b.loc).slice(0, 300);
  if (b.desc != null) o.description = String(b.desc).slice(0, 4000);
  if (b.allDay) { o.start = { date: String(b.s).slice(0, 10) }; o.end = { date: String(b.e || b.s).slice(0, 10) }; if (o.end.date <= o.start.date) o.end.date = new Date(Date.parse(o.start.date) + day).toISOString().slice(0, 10); }
  else { const tz = b.tz || "Asia/Kolkata"; o.start = { dateTime: b.s.length === 16 ? b.s + ":00" : b.s, timeZone: tz }; o.end = { dateTime: (b.e || b.s).length === 16 ? (b.e || b.s) + ":00" : b.e || b.s, timeZone: tz }; }
  return o;
}

/* ---------- gmail ---------- */
const hdr = (m, n) => (m.payload?.headers || []).find((h) => h.name.toLowerCase() === n)?.value || "";
const fromParts = (f) => { const m = String(f).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>/); return m ? { name: m[1].trim() || m[2], email: m[2].toLowerCase() } : { name: f, email: String(f).toLowerCase() }; };
async function pool(items, n, fn) { const out = []; let i = 0; await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { out[k] = null; } } })); return out; }
export async function readImportant(store, a, prefs = {}) {
  const vip = (prefs.vip || []).filter((x) => /@|\./.test(x)).slice(0, 30);
  const days = Math.max(1, Math.min(30, +prefs.days || 7));
  const q = `in:inbox newer_than:${days}d -category:promotions -category:social -category:forums (is:important OR is:starred${vip.length ? " OR from:(" + vip.join(" OR ") + ")" : ""})`;
  const list = await g(store, a, SCOPES.mail, `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=40&q=${encodeURIComponent(q)}`);
  const ids = (list.messages || []).map((m) => m.id);
  const msgs = await pool(ids, 8, (id) => g(store, a, SCOPES.mail, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`));
  return msgs.filter(Boolean).map((m) => { const f = fromParts(hdr(m, "from")); return { id: m.id, thread: m.threadId, acct: a.id, from: f.name.slice(0, 80), fromEmail: f.email.slice(0, 120), subj: hdr(m, "subject").slice(0, 200) || "(No subject)", snip: String(m.snippet || "").slice(0, 240), ts: +m.internalDate || Date.parse(hdr(m, "date")) || 0, unread: (m.labelIds || []).includes("UNREAD"), star: (m.labelIds || []).includes("STARRED"), vip: vip.some((v) => f.email.includes(v.toLowerCase())) }; });
}

/* ---------- subscriptions found in receipts ---------- */
const SUBS_Q = 'newer_than:400d (subject:(receipt OR invoice OR renewal OR renewed OR subscription OR "payment received" OR "payment successful" OR "your payment" OR "payment confirmation" OR billing OR "auto-pay" OR autopay OR autodebit OR membership OR "your plan" OR "order confirmation") OR from:(billing OR receipts OR invoice OR payments OR no_reply@email.apple.com OR googleplay-noreply@google.com)) -category:social';
const CUR = [["₹", "INR"], ["rs.", "INR"], ["rs", "INR"], ["inr", "INR"], ["us$", "USD"], ["$", "USD"], ["usd", "USD"], ["€", "EUR"], ["eur", "EUR"], ["£", "GBP"], ["gbp", "GBP"]];
export function parseAmount(text) {
  const t = String(text || "").replace(/ /g, " ");
  const re = /(₹|rs\.?|inr|us\$|\$|usd|€|eur|£|gbp)\s?([0-9]{1,3}(?:[, ][0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)(?![0-9])|([0-9]{1,3}(?:,[0-9]{2,3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s?(inr|usd|eur|gbp)\b/gi;
  let m, best = null;
  while ((m = re.exec(t))) {
    const sym = (m[1] || m[4] || "").toLowerCase(), num = parseFloat(String(m[2] || m[3]).replace(/[, ]/g, ""));
    if (!(num > 0) || num > 500000) continue;
    const cur = (CUR.find(([k]) => k === sym) || [, "INR"])[1];
    if (!best) best = { a: num, c: cur };
  }
  return best;
}
const NOISE = /\b(receipts?|billing|payments?|invoices?|no[-_ ]?reply|noreply|notifications?|team|support|accounts?|customer care|via|mailer|info|hello)\b/gi;
export function merchantOf(fromName, fromEmail, subj) {
  let n = String(fromName || "").replace(NOISE, "").replace(/[|•·:–-]+/g, " ").replace(/\s+/g, " ").trim();
  if (!n || n.length < 2 || /@/.test(n)) { const d = String(fromEmail || "").split("@")[1] || ""; const parts = d.split("."); n = (parts.length > 2 && parts[parts.length - 2].length <= 3 ? parts[parts.length - 3] : parts[parts.length - 2]) || d; n = n.charAt(0).toUpperCase() + n.slice(1); }
  if (/apple/i.test(fromEmail) && /icloud/i.test(subj)) n = "iCloud+";
  if (/google/i.test(fromEmail) && /youtube premium/i.test(subj)) n = "YouTube Premium";
  if (/google/i.test(fromEmail) && /google one/i.test(subj)) n = "Google One";
  return n.slice(0, 60);
}
// read a few more receipts each time (so a long history never needs one long run); returns how far it got
export async function scanReceipts(store, a, raw, until) {
  const st = raw[a.id] || (raw[a.id] = { cursor: "", done: false, n: 0, items: {} });
  if (st.done && Date.now() - (st.at || 0) < 20 * 3600e3) return st;
  if (st.done) { st.done = false; st.cursor = ""; st.fresh = true; } // once a day: look again from the newest
  while (Date.now() < until) {
    const list = await g(store, a, SCOPES.mail, `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=100&q=${encodeURIComponent(SUBS_Q)}${st.cursor ? "&pageToken=" + st.cursor : ""}`);
    const ids = (list.messages || []).map((m) => m.id).filter((id) => !st.items[id]);
    const left = Math.max(0, until - Date.now());
    const take = ids.slice(0, left > 6000 ? 100 : 40);
    const got = await pool(take, 10, (id) => g(store, a, SCOPES.mail, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`));
    got.forEach((m, i) => { if (!m) return; const f = fromParts(hdr(m, "from")), subj = hdr(m, "subject"), amt = parseAmount(subj + " " + (m.snippet || "")); st.items[take[i]] = amt ? { d: +m.internalDate, m: merchantOf(f.name, f.email, subj), e: f.email.slice(0, 80), a: amt.a, c: amt.c, s: subj.slice(0, 120) } : { d: +m.internalDate, skip: 1 }; });
    st.n += got.length;
    if (take.length < ids.length) break; // out of time for this page; the same page is read again next time
    if (st.fresh && !ids.length) { st.done = true; st.at = Date.now(); st.fresh = false; break; } // caught up with what was read before
    st.cursor = list.nextPageToken || "";
    if (!st.cursor) { st.done = true; st.at = Date.now(); st.fresh = false; break; }
  }
  // keep it small: only the receipts that had an amount, newest 1500
  const keep = Object.entries(st.items).sort((x, y) => y[1].d - x[1].d).slice(0, 3000); st.items = Object.fromEntries(keep);
  return st;
}
const CYCLES = [["weekly", 7, 5, 9], ["monthly", 30.4, 25, 36], ["quarterly", 91, 80, 100], ["half-yearly", 182, 165, 200], ["yearly", 365, 340, 390]];
export function suggestions(raw, no = []) {
  const groups = new Map();
  for (const st of Object.values(raw || {})) for (const [id, it] of Object.entries(st.items || {})) { if (it.skip || !it.m) continue; const k = it.m.toLowerCase().replace(/[^a-z0-9]+/g, ""); if (!groups.has(k)) groups.set(k, []); groups.get(k).push({ id, ...it }); }
  const out = [];
  for (const [k, list] of groups) {
    if (no.includes(k)) continue;
    // one charge per day per merchant (a receipt and an invoice for the same payment count once)
    const byDay = new Map(); for (const x of list.sort((a, b) => b.d - a.d)) { const dk = new Date(x.d).toISOString().slice(0, 10); if (!byDay.has(dk)) byDay.set(dk, x); }
    const pays = [...byDay.values()].sort((a, b) => a.d - b.d);
    const last = pays[pays.length - 1];
    const gaps = pays.slice(1).map((p, i) => (p.d - pays[i].d) / 864e5).filter((x) => x >= 4);
    const med = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 0;
    let cyc = med ? CYCLES.find(([, , lo, hi]) => med >= lo && med <= hi) : null;
    const words = pays.map((p) => p.s).join(" ").toLowerCase();
    if (!cyc && /annual|yearly|per year|\/yr|12 months/.test(words)) cyc = CYCLES[4];
    if (!cyc && /monthly|per month|\/mo\b|month/.test(words) && /subscri|renew|member|plan|premium|pro\b/.test(words)) cyc = CYCLES[1];
    if (!cyc) continue; // no rhythm and no hint: a one-off purchase
    const sure = pays.length >= 3 ? "high" : pays.length === 2 ? "medium" : "low";
    const next = new Date(last.d + cyc[1] * 864e5).toISOString().slice(0, 10);
    out.push({ key: k, name: list[0].m, amount: last.a, cur: last.c, cycle: cyc[0], last: new Date(last.d).toISOString().slice(0, 10), next, count: pays.length, sure, from: last.e, subj: last.s });
  }
  return out.sort((a, b) => (b.sure === "high") - (a.sure === "high") || b.last.localeCompare(a.last)).slice(0, 60);
}

/* ---------- refreshing what the Planner shows ---------- */
export async function refresh(store, { budgetMs = 8000, cal = true, mail = true, subs = false } = {}) {
  const until = Date.now() + budgetMs, accts = await accounts(store), prefs = (await store.get(PREFS, { type: "json" })) ?? {};
  const out = {};
  if (cal) {
    const cache = { ts: Date.now(), accounts: {} };
    await Promise.all(accts.filter((a) => a.cal !== false).map(async (a) => { try { const cals = await readCalendars(store, a); cache.accounts[a.id] = { email: a.email, cals, events: await readEvents(store, a, cals) }; } catch (e) { cache.accounts[a.id] = { email: a.email, error: String(e.message || e).slice(0, 300), reauth: e.code === "reauth" }; } }));
    await store.setJSON(CAL, cache); out.cal = cache;
  }
  if (mail) {
    const cache = { ts: Date.now(), accounts: {} };
    await Promise.all(accts.filter((a) => a.mail !== false).map(async (a) => { try { cache.accounts[a.id] = { email: a.email, msgs: await readImportant(store, a, prefs) }; } catch (e) { cache.accounts[a.id] = { email: a.email, error: String(e.message || e).slice(0, 300), reauth: e.code === "reauth" }; } }));
    await store.setJSON(MAIL, cache); out.mail = cache;
  }
  if (subs) {
    const raw = (await store.get(SUBS_RAW, { type: "json" })) ?? {};
    const errs = {};
    for (const a of accts.filter((x) => x.mail !== false)) { if (Date.now() > until - 1500) break; try { await scanReceipts(store, a, raw, until - 500); } catch (e) { errs[a.id] = String(e.message || e).slice(0, 300); } }
    await store.setJSON(SUBS_RAW, raw);
    out.subs = { progress: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, { n: v.n, done: !!v.done }])), errors: errs };
  }
  return out;
}
