// GET /api/pages            every link page for the home page grid, newest first, with its reel thumbnail
// GET /api/pages/:slug      one page's title, subtitle and count, plus whether the newsletter box starts ticked here
import { PAGES } from "../lib/pages.mjs";
import { json, newsDefault } from "../lib/core.mjs";

const main = (p) => p.items.filter((it) => !it.bonus).length;
const levels = (p) => p.items.map((it) => ({ level: it.level || "", bonus: !!it.bonus, ...(p.hidden ? {} : { name: it.name, tag: it.tag || "" }) }));

export default async (req, context) => {
  const slug = String(context.params?.slug || "").toLowerCase();
  if (!slug) {
    const pages = Object.entries(PAGES).reverse().map(([s, p]) => ({ slug: s, title: p.title, subtitle: p.subtitle || "", count: main(p), bonus: p.items.length - main(p), cover: p.cover || "" }));
    return json({ pages });
  }
  const p = PAGES[slug];
  if (!p) return json({ error: "not found" }, 404);
  return json({ slug, title: p.title, subtitle: p.subtitle || "", count: main(p), bonus: p.items.length - main(p), newsDefault: newsDefault(context), items: levels(p) });
};

export const config = { path: ["/api/pages", "/api/pages/:slug"], method: "GET" };
