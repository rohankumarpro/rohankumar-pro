// Serves the desktop (index.html) for every address on the site, with that page's own title, description, structured data
// and readable content already inside it. The desktop then opens the matching window on top.
// /journal/<slug>.md and /projects/<slug>.md give the same page as Markdown for AI tools.
import { connectLambda } from "@netlify/blobs";
import { contentStore, isPreviewHost } from "../lib/store.mjs";
import { resolve } from "../lib/pages.mjs";
import { renderShell } from "../lib/seo.mjs";
import { rawIndex } from "../lib/defaults.mjs";

export const handler = async (event) => {
  try {
    connectLambda(event);
    const q = event.queryStringParameters || {};
    const store = contentStore(event);
    const P = await resolve(event, store, q.p || "/");
    const preview = isPreviewHost(event);
    const common = { "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=120, stale-while-revalidate=86400", ...(preview ? { "x-robots-tag": "noindex" } : {}) };
    if (P.md) {
      if (!P.mdText || P.status !== 200) return { statusCode: 404, headers: { "content-type": "text/plain; charset=utf-8" }, body: "Not found" };
      return { statusCode: 200, headers: { ...common, "content-type": "text/markdown; charset=utf-8" }, body: P.mdText };
    }
    const ui = (await store.get("settings", { type: "json" }))?.ui === "minimal" ? "minimal" : "material";
    return { statusCode: P.status, headers: { ...common, "content-type": "text/html; charset=utf-8" }, body: renderShell(P, { preview, ui }) };
  } catch (e) {
    console.error("page", e);
    // If the extra search-engine content can't be built, still hand over the plain desktop so the site always opens.
    const preview = isPreviewHost(event), note = String(e?.stack || e).slice(0, 600);
    const html = rawIndex();
    if (html && !(event.queryStringParameters || {}).p?.endsWith(".md")) {
      return { statusCode: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-page-fallback": "1", ...(preview ? { "x-robots-tag": "noindex", "x-page-error": encodeURIComponent(note.split("\n")[0]).slice(0, 300) } : {}) }, body: html };
    }
    return { statusCode: 500, headers: { "content-type": "text/plain" }, body: preview ? "Page error: " + note : "Something went wrong. Please try again." };
  }
};
