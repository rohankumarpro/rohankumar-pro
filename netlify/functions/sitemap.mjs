// /sitemap.xml  Home page, the Journal list, and every published article.
import { connectLambda } from "@netlify/blobs";
import { loadPosts } from "../lib/posts.mjs";
import { contentStore } from "../lib/store.mjs";

const SITE = "https://rohankumar.pro";
const x = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

export const handler = async (event) => {
  let posts = [];
  try { connectLambda(event); posts = (await loadPosts(contentStore(event))).filter((p) => !p.draft); } catch {}
  const urls = [`${SITE}/`, `${SITE}/journal`, ...posts.map((p) => `${SITE}/journal/${p.slug}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${x(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return { statusCode: 200, headers: { "content-type": "application/xml", "cache-control": "public, max-age=300" }, body: xml };
};
