// /api/projects
//   GET            visitors: published projects (list, no content).  Owner: every project including drafts.
//   GET ?slug=     one full project (drafts and unlisted only for the owner or unlisted by direct link)
//   PUT {project}  owner: create or save one project.   PUT {order:[ids]}: owner reorders.
//                  Either may carry known:[project list as the page has it]. Blob reads can briefly lag a write, so the
//                  stored index may miss a project saved moments ago; projects the page knows about are kept, never dropped.
//   DELETE ?id=    owner
//   POST ?a=view|like {id}   anyone: counters (limited per address)
import { createHash } from "node:crypto";
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { contentStore } from "../lib/store.mjs";
import { saveJSON } from "../lib/safe.mjs";
import { cleanProject, metaOf, seedProjects, loadIndex, projKey, loadProject, uniqueSlug, publicList } from "../lib/projects.mjs";
import { pingIndexNow } from "../lib/indexnow.mjs";

async function tooMany(store, event, tag, max) {
  const h = event.headers || {};
  const ip = h["x-nf-client-connection-ip"] || String(h["x-forwarded-for"] || "").split(",")[0] || "unknown";
  const key = `rl-${tag}-${createHash("sha256").update(ip).digest("hex").slice(0, 12)}-${new Date().toISOString().slice(0, 13)}`;
  const n = Number(await store.get(key)) || 0;
  if (n >= max) return true;
  await store.set(key, String(n + 1));
  return false;
}

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    const admin = isAdmin(event), q = event.queryStringParameters || {}, m = event.httpMethod;
    const stats = (await store.get("project-stats", { type: "json" })) ?? {};
    const withStats = (o) => ({ ...o, views: stats[o.id]?.v || 0, likes: stats[o.id]?.l || 0 });
    let index = await loadIndex(store);
    const seeded = !index;
    if (seeded) { const settings = await store.get("settings", { type: "json" }); index = seedProjects(settings).map(metaOf); }

    if (m === "GET") {
      if (q.slug) {
        const meta = index.find((x) => x.slug === q.slug);
        if (!meta || (meta.status === "draft" && !admin)) return json({ error: "Not found" }, 404);
        const full = seeded ? seedProjects(await store.get("settings", { type: "json" })).find((x) => x.id === meta.id) : await loadProject(store, meta.id);
        if (!full) return json({ error: "Not found" }, 404);
        const pos = publicList(index).findIndex((x) => x.id === meta.id), pub = publicList(index);
        return json({ project: withStats(full), prev: pub[pos - 1] ? { slug: pub[pos - 1].slug, title: pub[pos - 1].title } : null, next: pub[pos + 1] ? { slug: pub[pos + 1].slug, title: pub[pos + 1].title } : null });
      }
      if (q.id && admin) {
        const full = seeded ? seedProjects(await store.get("settings", { type: "json" })).find((x) => x.id === q.id) : await loadProject(store, q.id);
        return full ? json({ project: withStats(full) }) : json({ error: "Not found" }, 404);
      }
      return json({ projects: (admin ? index : publicList(index)).map(withStats), seeded: admin ? seeded : undefined });
    }

    if (m === "POST") {
      const b = body(event);
      if (!b || !index.some((x) => x.id === b.id)) return json({ error: "Bad request" }, 400);
      if (!["view", "like"].includes(q.a)) return json({ error: "Bad request" }, 400);
      if (await tooMany(store, event, "p" + q.a, q.a === "like" ? 30 : 120)) return json({ error: "Too many requests" }, 429);
      const s = stats[b.id] || { v: 0, l: 0 };
      if (q.a === "view") s.v++; else s.l = Math.max(0, s.l + (b.undo ? -1 : 1));
      stats[b.id] = s; await store.setJSON("project-stats", stats);
      return json({ ok: true, views: s.v, likes: s.l });
    }

    if (!admin) return json({ error: "Not signed in" }, 401);

    if (m === "PUT") {
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      if (seeded) { for (const p of seedProjects(await store.get("settings", { type: "json" }))) await store.setJSON(projKey(p.id), p); }
      for (const k of Array.isArray(b.known) ? b.known.slice(0, 500) : []) {
        if (!k || !/^[\w-]{3,24}$/.test(k.id || "") || index.some((x) => x.id === k.id)) continue;
        const meta = metaOf(cleanProject({ ...k, blocks: [] }, { ts: k.ts, publishedAt: k.publishedAt }));
        meta.words = Math.max(0, Math.round(+k.words || 0)); meta.updated = Number(k.updated) || meta.updated;
        index.push(meta);
      }
      if (Array.isArray(b.order)) {
        const by = new Map(index.map((x) => [x.id, x])), out = [];
        for (const id of b.order) if (by.has(id)) { out.push(by.get(id)); by.delete(id); }
        out.push(...by.values());
        await saveJSON(store, "projects-index", out);
        return json({ ok: true, projects: out.map(withStats) });
      }
      if (!b.project || typeof b.project !== "object") return json({ error: "Missing project" }, 400);
      const prev = (index.find((x) => x.id === b.project.id) && (await loadProject(store, b.project.id))) || {};
      const p = cleanProject(b.project, prev);
      if (!p.title) p.title = "Untitled project";
      p.slug = uniqueSlug(p.slug, p.id, index);
      if (JSON.stringify(p).length > 3_500_000) return json({ error: "This project is too large to save" }, 413);
      await store.setJSON(projKey(p.id), p);
      const meta = metaOf(p), i = index.findIndex((x) => x.id === p.id);
      const next = i < 0 ? [meta, ...index] : index.map((x, j) => (j === i ? meta : x));
      await saveJSON(store, "projects-index", next);
      if (p.status === "published") await pingIndexNow(event, [`/projects/${p.slug}`, "/projects", "/sitemap.xml"]);
      return json({ ok: true, project: withStats(p), projects: next.map(withStats) });
    }

    if (m === "DELETE") {
      const i = index.findIndex((x) => x.id === q.id);
      if (i < 0) return json({ error: "Not found" }, 404);
      if (seeded) { for (const p of seedProjects(await store.get("settings", { type: "json" }))) await store.setJSON(projKey(p.id), p); }
      await store.delete(projKey(q.id));
      const next = index.filter((x) => x.id !== q.id);
      await saveJSON(store, "projects-index", next);
      return json({ ok: true, projects: next.map(withStats) });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
