// Writes public/<slug>.html for every page in netlify/lib/pages.mjs, from public/page.html, with that page's title and
// share preview (public/assets/og/<slug>.png when it exists). Run after adding or renaming a page:  node scripts/page-files.mjs
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { PAGES } from "../netlify/lib/pages.mjs";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const tpl = readFileSync(new URL("../public/page.html", import.meta.url), "utf8");
for (const [slug, p] of Object.entries(PAGES)) {
  const url = `https://link.sansser.com/${slug}`, img = existsSync(new URL(`../public/assets/og/${slug}.png`, import.meta.url)) ? `https://link.sansser.com/assets/og/${slug}.png` : "";
  const desc = p.subtitle || "Links from Rohan's reels on AI, automations and tech.";
  const meta = [
    `<title>${esc(p.title)} · Sansser</title>`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:type" content="website"><meta property="og:site_name" content="Sansser">`,
    `<meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">`,
    img && `<meta property="og:image" content="${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${esc(p.title)}"><meta name="twitter:description" content="${esc(desc)}">`,
    img && `<meta name="twitter:image" content="${img}">`,
  ].filter(Boolean).join("\n");
  writeFileSync(new URL(`../public/${slug}.html`, import.meta.url), tpl.replace("<title>Sansser links</title>", meta));
  console.log("wrote public/" + slug + ".html");
}
