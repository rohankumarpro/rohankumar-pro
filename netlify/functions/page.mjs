// Serves the desktop (index.html) for every address on the site, with that page's own title, description, structured data
// and readable content already inside it. The desktop then opens the matching window on top.
// /journal/<slug>.md and /projects/<slug>.md give the same page as Markdown for AI tools.
import { connectLambda } from "@netlify/blobs";
import { contentStore, isPreviewHost } from "../lib/store.mjs";
import { resolve } from "../lib/pages.mjs";
import { renderShell } from "../lib/seo.mjs";

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
    return { statusCode: P.status, headers: { ...common, "content-type": "text/html; charset=utf-8" }, body: renderShell(P, { preview }) };
  } catch (e) {
    console.error("page", e);
    return { statusCode: 500, headers: { "content-type": "text/plain" }, body: "Something went wrong. Please try again." };
  }
};
