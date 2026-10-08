// /api/sv  The site's own visitor counts (see netlify/lib/analytics.mjs).
//   POST {k, p?, r?, s?, a?, h?, n?, w?, t?}   anyone: one hit. Robots, the owner and previews' visitors on the live store are never counted.
//   GET ?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<minutes>   owner: the numbers for that period, and for the period before it
//   GET ?a=live                                       owner: who is on the site in the last 5 minutes
// Netlify Functions 2.0, so the visitor's country comes from Netlify's own lookup (the address itself is never stored).
import { getStore } from "@netlify/blobs";
import { isAdmin, json } from "../lib/session.mjs";
import { isPreviewHost } from "../lib/store.mjs";
import { makeRow, isBot, loadDay, summarise, dayOf } from "../lib/analytics.mjs";

const store = (event) => getStore(isPreviewHost(event) ? "site-content-dev" : "site-content");
const out = (r) => new Response(r.body, { status: r.statusCode, headers: r.headers });
// a few hits per second from one address is a script, not a person
const recent = new Map();
function flood(ip) {
  const now = Date.now(), list = (recent.get(ip) || []).filter((t) => now - t < 60e3);
  list.push(now); recent.set(ip, list); if (recent.size > 5000) recent.clear();
  return list.length > 60;
}
const ymd = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) ? String(s) : "";
const addDays = (d, n) => dayOf(Date.parse(d + "T00:00:00Z") + n * 864e5);
function daysBetween(a, b) { const out = []; for (let d = a; d <= b && out.length < 400; d = addDays(d, 1)) out.push(d); return out; }

export default async (req, context) => {
  const u = new URL(req.url);
  const event = { headers: Object.fromEntries(req.headers) };
  try {
    if (req.method === "POST") {
      const ua = req.headers.get("user-agent") || "";
      if (isAdmin(event)) return out(json({ own: true })); // the owner is never counted
      if (isBot(ua)) return new Response(null, { status: 204 });
      let b = null; try { b = JSON.parse(await req.text()); } catch {}
      if (!b || typeof b !== "object") return new Response(null, { status: 204 });
      const ip = context?.ip || req.headers.get("x-nf-client-connection-ip") || String(req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "0";
      if (flood(ip)) return new Response(null, { status: 204 });
      const host = String(req.headers.get("x-forwarded-host") || req.headers.get("host") || "").replace(/^www\./, "").split(":")[0];
      const made = makeRow(b, { ip, ua, country: context?.geo?.country?.code || "", host });
      if (made) await store(event).set(made.key, "1");
      return new Response(null, { status: 204 });
    }
    if (req.method !== "GET") return out(json({ error: "Method not allowed" }, 405));
    if (!isAdmin(event)) return out(json({ error: "Not signed in" }, 401));
    const st = store(event), today = dayOf(Date.now());
    if (u.searchParams.get("a") === "live") {
      const since = Date.now() - 5 * 60e3, rows = (await loadDay(st, today, today)).filter((r) => r.ts >= since);
      const people = new Set(rows.map((r) => r.v));
      return out(json({ now: people.size, apps: [...new Set(rows.filter((r) => r.k === "a").map((r) => r.a))].slice(0, 6) }));
    }
    const tz = Math.max(-840, Math.min(840, Math.round(+u.searchParams.get("tz") || 0))); // minutes, as the browser's getTimezoneOffset gives them
    const local = (ts) => dayOf(ts - tz * 60e3);
    let to = ymd(u.searchParams.get("to")) || local(Date.now()), from = ymd(u.searchParams.get("from")) || addDays(to, -29);
    if (from > to) [from, to] = [to, from];
    const days = daysBetween(from, to), n = days.length;
    const pFrom = addDays(from, -n), pTo = addDays(from, -1), pDays = daysBetween(pFrom, pTo);
    // the owner's days straddle two UTC days, so one extra on each side
    const utc = daysBetween(addDays(pFrom, -1), addDays(to, 1)).filter((d) => d <= today);
    const all = (await Promise.all(utc.map((d) => loadDay(st, d, today)))).flat();
    const inP = (r, a, b) => { const d = local(r.ts); return d >= a && d <= b; };
    const cur = summarise(all.filter((r) => inP(r, from, to)), local, days);
    const prev = summarise(all.filter((r) => inP(r, pFrom, pTo)), local, pDays);
    // the first day anything was counted, remembered once
    let since = await st.get("an-start").catch(() => null);
    if (!since && all.length) { since = local(all.reduce((m, r) => Math.min(m, r.ts), Infinity)); await st.set("an-start", since).catch(() => {}); }
    return out(json({ from, to, ...cur, prev: prev.totals, since: since || "" }));
  } catch (e) {
    return out(json({ error: "Server error", detail: String(e?.message || e) }, 500));
  }
};
