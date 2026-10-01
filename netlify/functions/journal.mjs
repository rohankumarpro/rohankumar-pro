// /api/journal  GET: anyone reads published articles (owner also sees drafts).  PUT: only the signed-in owner saves.
import { connectLambda, getStore } from "@netlify/blobs";
import { isAdmin, body, json } from "../lib/session.mjs";
import { cleanPosts, loadPosts } from "../lib/posts.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const store = getStore("site-content");
    if (event.httpMethod === "GET") {
      const posts = await loadPosts(store);
      return json({ posts: isAdmin(event) ? posts : posts.filter((p) => !p.draft) });
    }
    if (event.httpMethod === "PUT") {
      if (!isAdmin(event)) return json({ error: "Not signed in" }, 401);
      const b = body(event);
      if (!b) return json({ error: "Bad JSON" }, 400);
      const posts = cleanPosts(b.posts);
      await store.setJSON("journal", posts);
      return json({ ok: true, posts });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: "Server error", detail: String(e?.message || e) }, 500);
  }
};
