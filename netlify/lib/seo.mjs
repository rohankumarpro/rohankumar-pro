// Turns a page description from pages.mjs into the <head> tags and the readable HTML that search engines and AI tools see.
import { esc } from "../../shared/blocks.mjs";
import { SITE } from "./site-data.mjs";
import { abs, NAME } from "./pages.mjs";
import { rawIndex } from "./defaults.mjs";

const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (v === undefined || v === "" ? undefined : v)));
export function jsonLd(list) { return JSON.stringify({ "@context": "https://schema.org", "@graph": clean(list.filter(Boolean)) }).replace(/</g, "\\u003c"); }

export function headHtml(P, { preview } = {}) {
  const url = SITE + (P.path === "/" ? "/" : P.path.replace(/\/$/, "")) ;
  const canon = P.notFound ? "" : url;
  const robots = P.noindex || preview || P.status !== 200 ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const img = abs(P.image);
  const t = [
    `<title>${esc(P.title)}</title>`,
    `<meta name="description" content="${esc(P.desc)}">`,
    canon ? `<link rel="canonical" href="${esc(canon)}">` : "",
    `<meta name="robots" content="${robots}">`,
    `<meta name="author" content="${esc(NAME)}">`,
    `<meta property="og:site_name" content="${esc(NAME)}"><meta property="og:locale" content="en_US">`,
    `<meta property="og:type" content="${P.type === "article" ? "article" : P.type === "profile" ? "profile" : "website"}">`,
    `<meta property="og:title" content="${esc(P.title)}"><meta property="og:description" content="${esc(P.desc)}">`,
    canon ? `<meta property="og:url" content="${esc(canon)}">` : "",
    `<meta property="og:image" content="${esc(img)}">${P.imageAlt ? `<meta property="og:image:alt" content="${esc(P.imageAlt)}">` : ""}`,
    `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(P.title)}"><meta name="twitter:description" content="${esc(P.desc)}"><meta name="twitter:image" content="${esc(img)}">`,
    P.published ? `<meta property="article:published_time" content="${esc(P.published)}">` : "",
    P.modified ? `<meta property="article:modified_time" content="${esc(P.modified)}">` : "",
    P.section ? `<meta property="article:section" content="${esc(P.section)}">` : "",
    ...(P.tags || []).map((x) => `<meta property="article:tag" content="${esc(x)}">`),
    P.type === "article" ? `<meta property="article:author" content="${SITE}/about">` : "",
    `<link rel="alternate" type="application/rss+xml" title="${esc(NAME)} — Journal" href="/feed.xml"><link rel="alternate" type="application/feed+json" title="${esc(NAME)} — Journal (JSON Feed)" href="/feed.json">`,
    P.mdText && canon ? `<link rel="alternate" type="text/markdown" href="${esc(canon === SITE + "/" ? SITE + "/index.md" : canon + ".md")}">` : "",
    `<link rel="alternate" type="text/plain" title="llms.txt" href="/llms.txt">`,
    P.ld?.length ? `<script type="application/ld+json">${jsonLd(P.person && !P.ld.some((n) => n["@id"] === P.person["@id"]) ? [...P.ld, P.person] : P.ld)}</script>` : "",
    `<script>window.__ROUTE__=${JSON.stringify({ app: P.app || "", slug: P.slug || "", status: P.status, path: P.path, title: P.title }).replace(/</g, "\\u003c")}</script>`,
  ];
  return t.filter(Boolean).join("\n");
}

export function renderShell(P, opts = {}) {
  let html = rawIndex();
  if (!html) return `<!doctype html><title>${esc(P.title)}</title><p>${esc(P.desc)}</p>`;
  html = html.replace(/<!--seo:head-->[\s\S]*?<!--\/seo:head-->/, () => `<!--seo:head-->\n${headHtml(P, opts)}\n<!--/seo:head-->`);
  html = html.replace(/<!--seo:body-->[\s\S]*?<!--\/seo:body-->/, () => `<!--seo:body--><div id="seo">${P.body || ""}</div><!--/seo:body-->`);
  return html;
}
