// /api/journal  GET: anyone reads published articles (owner also sees drafts).  PUT: only the signed-in owner saves.
import { connectLambda } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { cleanPosts, loadPosts, isLive } from "../lib/posts.mjs";
import { pingIndexNow } from "../lib/indexnow.mjs";
import { contentStore } from "../lib/store.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = contentStore(event);
    if (event.httpMethod === "GET") {
      const posts = await loadPosts(store);
      return json({ posts: isAdmin(event) ? posts : posts.filter((p) => isLive(p)) });
    }
    if (event.httpMethod === "PUT") {
      if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const posts = cleanPosts(b.posts);
      const before = new Map((await loadPosts(store)).map((p) => [p.slug, p.body + p.title + (p.draft ? "d" : "")]));
      // an article keeps its modified date unless its content really changed
      const old = new Map((await loadPosts(store)).map((p) => [p.slug, p]));
      for (const p of posts) { const o = old.get(p.slug); if (o && o.body + o.title === p.body + p.title && o.modified) p.modified = o.modified; }
      await store.setJSON("journal", posts);
      const changed = posts.filter((p) => isLive(p) && before.get(p.slug) !== p.body + p.title).map((p) => `/journal/${p.slug}`);
      if (changed.length) await pingIndexNow(event, [...changed, "/journal", "/sitemap.xml", "/feed.xml"]);
      return json({ ok: true, posts });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
