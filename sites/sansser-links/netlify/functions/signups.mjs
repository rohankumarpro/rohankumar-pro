// GET /api/signups?key=<ADMIN_KEY>             everyone who unlocked a page, newest first (JSON)
// GET /api/signups?key=<ADMIN_KEY>&format=csv  the same as a spreadsheet
// GET /api/signups?key=<ADMIN_KEY>&stores=1    the names of every data store on this site (to find older data)
import { getStore, listStores } from "@netlify/blobs";
import { json } from "../lib/core.mjs";
import { timingSafeEqual } from "node:crypto";

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const cell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export default async (req) => {
  const u = new URL(req.url), want = Netlify.env.get("ADMIN_KEY") || "", key = u.searchParams.get("key") || "";
  if (!want || !same(key, want)) return json({ error: "Not allowed" }, 401);
  if (u.searchParams.get("stores")) return json(await listStores());
  const store = getStore({ name: "sansser-unlocks", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "u/" });
  const rows = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" }).catch(() => null)))).filter(Boolean).sort((a, b) => b.ts - a.ts);
  if (u.searchParams.get("format") === "csv") {
    const cols = ["email", "slug", "newsletter", "preticked", "ts", "times", "country", "src", "ref"];
    const body = [cols.join(","), ...rows.map((r) => cols.map((c) => cell(c === "ts" ? new Date(r.ts).toISOString() : typeof r[c] === "boolean" ? (r[c] ? "yes" : "no") : r[c])).join(","))].join("\n");
    return new Response(body, { headers: { "content-type": "text/csv; charset=utf-8", "cache-control": "no-store", "content-disposition": `attachment; filename="sansser-signups-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }
  return json({ total: rows.length, newsletter: rows.filter((r) => r.newsletter).length, signups: rows });
};

export const config = { path: "/api/signups", method: "GET" };
