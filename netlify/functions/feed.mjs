// /feed.xml (RSS 2.0) and /feed.json (JSON Feed 1.1): the Journal, with full article text, for readers, search and AI tools.
import { connectLambda } from "@netlify/blobs";
import { contentStore } from "../lib/store.mjs";
import { SITE, loadProfile, loadLivePosts, isoDate } from "../lib/site-data.mjs";
import { blocksOf } from "../lib/posts.mjs";
import { renderBlocks, firstImage } from "../../shared/blocks.mjs";
import { CAROUSELS } from "../lib/media.mjs";
import { abs } from "../lib/pages.mjs";

const x = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const cdata = (s) => `<![CDATA[${String(s).replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;

export const handler = async (event) => {
  connectLambda(event);
  const store = contentStore(event), pr = await loadProfile(store), posts = (await loadLivePosts(store)).slice(0, 30);
  const html = (p) => renderBlocks(blocksOf(p), { hBase: 2, media: { carousels: CAROUSELS } }).replace(/(src|href)="\/(?!\/)/g, `$1="${SITE}/`).replace(/srcset="[^"]*"/g, "");
  const headers = { "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=600, stale-while-revalidate=86400" };
  if (/feed\.json/.test(event.path || event.rawUrl || "")) {
    const feed = { version: "https://jsonfeed.org/version/1.1", title: `${pr.name} — Journal`, home_page_url: `${SITE}/journal`, feed_url: `${SITE}/feed.json`, description: `Notes on branding, design, and working with AI by ${pr.name}.`, language: "en",
      authors: [{ name: pr.name, url: `${SITE}/about` }], items: posts.map((p) => ({ id: `${SITE}/journal/${p.slug}`, url: `${SITE}/journal/${p.slug}`, title: p.title, summary: p.excerpt, content_html: html(p), date_published: isoDate(p) ? isoDate(p) + "T00:00:00Z" : undefined, date_modified: p.modified, tags: [p.tag, ...(p.tags || [])].filter(Boolean), image: p.img ? abs(p.img) : undefined })) };
    return { statusCode: 200, headers: { ...headers, "content-type": "application/feed+json; charset=utf-8" }, body: JSON.stringify(feed) };
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
<title>${x(pr.name)} — Journal</title><link>${SITE}/journal</link><atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/><description>Notes on branding, design, and working with AI by ${x(pr.name)}.</description><language>en</language>
${posts.map((p) => `<item><title>${x(p.title)}</title><link>${SITE}/journal/${x(p.slug)}</link><guid isPermaLink="true">${SITE}/journal/${x(p.slug)}</guid>${isoDate(p) ? `<pubDate>${new Date(isoDate(p) + "T00:00:00Z").toUTCString()}</pubDate>` : ""}<dc:creator>${x(pr.name)}</dc:creator>${[p.tag, ...(p.tags || [])].filter(Boolean).map((t) => `<category>${x(t)}</category>`).join("")}<description>${x(p.excerpt)}</description><content:encoded>${cdata(html(p))}</content:encoded>${p.img || firstImage(blocksOf(p)) ? `<enclosure url="${x(abs(p.img || firstImage(blocksOf(p))))}" type="image/jpeg" length="0"/>` : ""}</item>`).join("\n")}
</channel></rss>\n`;
  return { statusCode: 200, headers: { ...headers, "content-type": "application/rss+xml; charset=utf-8" }, body: xml };
};
