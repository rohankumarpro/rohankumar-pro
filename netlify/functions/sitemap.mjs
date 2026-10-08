// /sitemap.xml  Every public page, with its last-changed date and pictures. New articles and projects appear here by themselves.
import { connectLambda } from "@netlify/blobs";
import { contentStore } from "../lib/store.mjs";
import { SITE, loadProfile, loadLivePosts, projectIndex, loadPhotos, isoDate } from "../lib/site-data.mjs";
import { APP_PAGES, abs } from "../lib/pages.mjs";
import { slugify, firstImage } from "../../shared/blocks.mjs";
import { blocksOf } from "../lib/posts.mjs";

const x = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

export const handler = async (event) => {
  connectLambda(event);
  const store = contentStore(event);
  const pr = await loadProfile(store), hidden = new Set(pr.settings.hiddenApps || []);
  const posts = await loadLivePosts(store), projects = (await projectIndex(store)).filter((m) => m.status === "published");
  const photos = await loadPhotos(store);
  const today = new Date().toISOString().slice(0, 10);
  const urls = [];
  const add = (path, lastmod, images = [], pri) => urls.push({ loc: SITE + path, lastmod, images: images.filter(Boolean).map(abs), pri });
  add("/", today, [], "1.0");
  // static pages carry no date: a date that changes on every visit teaches search engines to ignore it
  for (const id of ["about", "resume", "contact", "timeline", "links", "services"]) if (!hidden.has(id) && !(pr.placeholder && ["about", "resume"].includes(id)) && !(id === "timeline" && !(pr.settings.timeline || []).length) && !(id === "services" && !(pr.settings.services || []).length)) add(APP_PAGES[id].path, "", [], "0.7");
  if (!hidden.has("projects") && !(pr.placeholder && projects.every((p) => /^Project /.test(p.title)))) {
    add("/projects", projects[0]?.updated ? new Date(projects[0].updated).toISOString().slice(0, 10) : today, projects.map((p) => p.cover?.src), "0.8");
    for (const p of projects) add(`/projects/${p.slug}`, new Date(p.updated || p.ts || Date.now()).toISOString().slice(0, 10), [p.cover?.src], "0.8");
  }
  if (!hidden.has("journal")) {
    add("/journal", posts[0] ? (posts[0].modified || isoDate(posts[0]) || today).slice(0, 10) : today, [], "0.8");
    const tags = new Map(); for (const p of posts) for (const t of [p.tag, ...(p.tags || [])].filter(Boolean)) tags.set(slugify(t), (tags.get(slugify(t)) || 0) + 1);
    for (const [t, n] of tags) if (n > 1) add(`/journal/tag/${t}`, "", [], "0.4"); // tags with a single article stay out (thin pages)
    for (const p of posts) if (!p.noindex) add(`/journal/${p.slug}`, (p.modified || isoDate(p) || today).slice(0, 10), [p.img || firstImage(blocksOf(p))], "0.9");
  }
  if (photos.length && !hidden.has("photos")) add("/photos", "", photos.slice(0, 20).map((p) => `/api/photo?id=${p.id}&s=f`), "0.4");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.map((u) =>
    `  <url><loc>${x(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}${u.pri ? `<priority>${u.pri}</priority>` : ""}${u.images.map((i) => `<image:image><image:loc>${x(i)}</image:loc></image:image>`).join("")}</url>`).join("\n")}\n</urlset>\n`;
  return { statusCode: 200, headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=0, must-revalidate", "netlify-cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=86400" }, body: xml };
};
