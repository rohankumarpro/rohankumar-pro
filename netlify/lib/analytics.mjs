// Visitor analytics, counted here on the site itself. No cookies, nothing personal kept.
//
// Each hit is one record whose details live in its key, so a day can be read with a single list (no reads per hit),
// and two visitors arriving at the same moment never overwrite each other (nothing is read and written back).
//   an-h-<YYYY-MM-DD>-<ts36>-<rand>-<data>   one hit (UTC day). The value is just "1"; the data is base64url JSON.
//   an-day-<YYYY-MM-DD>                      every hit of a finished UTC day in one record, made the first time the
//                                            day is looked at, so old days are one read. The hit records are kept.
// A visitor is a hash of the address and browser with a key that changes every day (the same method Plausible uses):
// honest daily counts without cookies, and nobody can be followed from one day to the next.
import { createHmac } from "node:crypto";

export const HIT = "an-h-", DAY = "an-day-";
const str = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, n);
export const dayOf = (ts) => new Date(ts).toISOString().slice(0, 10);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const unb64 = (s) => { try { return JSON.parse(Buffer.from(s, "base64url").toString()); } catch { return null; } };

/* ---------- who is a robot ---------- */
const BOT = /bot|crawl|spider|slurp|scrap|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|prerender|facebookexternalhit|embedly|quora link|whatsapp|telegram|discord|slack|skype|vkshare|bing|yandex|baidu|duckduck|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|chatgpt|claude|anthropic|perplexity|ccbot|python|curl|wget|httpie|go-http|java\/|okhttp|axios|node-fetch|undici|phantom|puppeteer|playwright|selenium|electron\/|cypress/i;
export const isBot = (ua) => !ua || ua.length < 20 || BOT.test(ua);

export function device(ua, w, touch) {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/i.test(ua) && touch)) return "Tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua) || (w && w < 600)) return "Phone";
  return "Desktop";
}
export function browser(ua) {
  if (/Edg\//.test(ua)) return "Edge"; if (/OPR\/|Opera/.test(ua)) return "Opera"; if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox|FxiOS/.test(ua)) return "Firefox"; if (/Chrome|CriOS/.test(ua)) return "Chrome"; if (/Safari/.test(ua)) return "Safari"; return "Other";
}
export function os(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS"; if (/Android/.test(ua)) return "Android"; if (/Windows/.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/.test(ua)) return "macOS"; if (/CrOS/.test(ua)) return "ChromeOS"; if (/Linux/.test(ua)) return "Linux"; return "Other";
}
export function visitorId(ip, ua, day) {
  const key = "rk-an-v1|" + (process.env.ADMIN_PASSWORD || "no-key");
  return createHmac("sha256", key).update(day + "|" + ip + "|" + ua).digest("base64url").slice(0, 11);
}
// where a visit came from: a campaign tag first, then the site that linked here
export function source(ref, utm, host) {
  const u = str(utm, 40).toLowerCase(); if (u) return u;
  if (!ref) return "";
  try { const h = new URL(ref).hostname.replace(/^www\.|^m\.|^l\.|^lm\./, ""); if (!h || h === host || h.endsWith("." + host)) return ""; return h.slice(0, 60); } catch { return ""; }
}

/* ---------- writing one hit ---------- */
const KINDS = new Set(["v", "a", "o", "e"]); // view (a page load), app opened, link out, engaged seconds
export function makeRow(b, { ip, ua, country, host, now = Date.now() }) {
  const k = KINDS.has(b.k) ? b.k : null; if (!k) return null;
  const day = dayOf(now);
  const r = { k, v: visitorId(ip, ua, day), d: device(ua, +b.w || 0, !!b.t), b: browser(ua), o: os(ua), c: str(country, 2).toUpperCase() };
  if (k === "v") { r.p = str(b.p, 90) || "/"; const s = source(b.r, b.s, host); if (s) r.s = s; }
  if (k === "a") r.a = str(b.a, 24).replace(/[^\w-]/g, "");
  if (k === "o") { r.h = str(b.h, 60).replace(/^www\./, ""); if (!r.h) return null; }
  if (k === "e") { const n = Math.round(+b.n || 0); if (!(n >= 1)) return null; r.n = Math.min(n, 1800); }
  return { key: `${HIT}${day}-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}-${b64(r)}`, row: { ...r, ts: now } };
}

/* ---------- reading days back ---------- */
function parseKey(key) {
  const m = key.slice(HIT.length).match(/^(\d{4}-\d{2}-\d{2})-([0-9a-z]+)-[0-9a-z]+-(.+)$/); if (!m) return null;
  const r = unb64(m[3]); if (!r) return null; r.ts = parseInt(m[2], 36); return r;
}
async function listDay(store, day) {
  const { blobs } = await store.list({ prefix: HIT + day + "-" });
  return blobs.map((b) => parseKey(b.key)).filter(Boolean);
}
// a finished day is kept as one record the first time it is read
export async function loadDay(store, day, today) {
  const done = day < today;
  if (done) { const c = await store.get(DAY + day, { type: "json" }).catch(() => null); if (c && Array.isArray(c.rows)) return c.rows; }
  const rows = await listDay(store, day);
  if (done && day < dayOf(Date.now() - 36 * 3600e3)) await store.setJSON(DAY + day, { rows, made: Date.now() }).catch(() => {});
  return rows;
}

/* ---------- the numbers ---------- */
const VISIT_GAP = 30 * 60e3;
const top = (m, n = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));
const bump = (m, k, n = 1) => m.set(k, (m.get(k) || 0) + n);

// rows: every hit in the period, already cut to it. local(ts) gives the owner's own calendar day.
export function summarise(rows, local, days) {
  const byVisitor = new Map();
  for (const r of rows) { const key = r.v + "|" + local(r.ts); (byVisitor.get(key) || byVisitor.set(key, []).get(key)).push(r); }
  const series = new Map(days.map((d) => [d, { d, visitors: 0, visits: 0, views: 0 }]));
  const pages = new Map(), apps = new Map(), appPeople = new Map(), sources = new Map(), countries = new Map(), devices = new Map(), browsers = new Map(), oses = new Map(), outs = new Map();
  let visitors = 0, visits = 0, views = 0, bounces = 0, engaged = 0;
  for (const [key, list] of byVisitor) {
    const day = key.split("|")[1], s = series.get(day); if (!s) continue;
    list.sort((a, b) => a.ts - b.ts);
    const first = list[0]; visitors++; s.visitors++;
    bump(countries, first.c || "??"); bump(devices, first.d); bump(browsers, first.b); bump(oses, first.o);
    const seenApps = new Set();
    let last = -Infinity, cur = null, lastView = null;
    const close = () => { if (!cur) return; if (cur.acts <= 1 && cur.secs < 10) bounces++; };
    for (const r of list) {
      if (r.ts - last > VISIT_GAP) { close(); cur = { acts: 0, secs: 0 }; visits++; s.visits++; bump(sources, (r.k === "v" && r.s) || "Direct / none"); }
      last = r.ts;
      if (r.k === "v") {
        if (lastView && lastView.p === r.p && r.ts - lastView.ts < 10e3) continue; // the same page loaded twice in a row (a double load, not a second look)
        lastView = r; views++; s.views++; cur.acts++; bump(pages, r.p);
      } else if (r.k === "a") { cur.acts++; bump(apps, r.a); if (!seenApps.has(r.a)) { seenApps.add(r.a); bump(appPeople, r.a); } }
      else if (r.k === "o") { cur.acts++; bump(outs, r.h); }
      else if (r.k === "e") { cur.secs += r.n; engaged += r.n; }
    }
    close();
  }
  return {
    totals: { visitors, visits, views, bounce: visits ? Math.round((bounces / visits) * 100) : 0, engaged: visitors ? Math.round(engaged / visitors) : 0, appOpens: [...apps.values()].reduce((a, b) => a + b, 0), clicksOut: [...outs.values()].reduce((a, b) => a + b, 0) },
    series: [...series.values()],
    pages: top(pages), apps: top(apps, 30).map((x) => ({ ...x, people: appPeople.get(x.k) || 0 })), sources: top(sources), countries: top(countries, 20), devices: top(devices), browsers: top(browsers), os: top(oses), outs: top(outs),
  };
}
