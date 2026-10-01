// /journal and /journal/<slug>  Server-rendered pages so Google and AI tools can read the articles.
import { connectLambda, getStore } from "@netlify/blobs";
import { loadPosts } from "../lib/posts.mjs";

const SITE = "https://rohankumar.pro", NAME = "Rohan Kumar", BOOKING = "https://cal.com/rohankumarpro";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const inl = (t) =>
  esc(t.replace(/\\\*/g, "\u0001")).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\u0001/g, "*");
function md(src) {
  return String(src || "").trim().split(/\n\s*\n/).map((block) => {
    const L = block.split("\n").map((x) => x.trim());
    if (L.every((x) => x.startsWith("- "))) return `<ul>${L.map((x) => `<li>${inl(x.slice(2))}</li>`).join("")}</ul>`;
    if (L.every((x) => /^\d+\.\s/.test(x))) return `<ol>${L.map((x) => `<li>${inl(x.replace(/^\d+\.\s/, ""))}</li>`).join("")}</ol>`;
    const t = L.join(" ");
    if (t.startsWith("### ")) return `<h3>${inl(t.slice(4))}</h3>`;
    if (t.startsWith("## ")) return `<h2>${inl(t.slice(3))}</h2>`;
    if (t.startsWith("> ")) return `<blockquote>${inl(t.slice(2))}</blockquote>`;
    if (/^\[\[carousel:\w+\]\]$/.test(t)) return "";
    if (t.startsWith("!! ")) return `<p><strong>${inl(t.slice(3))}</strong> <a href="${BOOKING}">Book a call</a></p>`;
    return `<p>${inl(t)}</p>`;
  }).join("\n");
}
const MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
function iso(d) {
  const m = String(d || "").replace(",", "").split(" ");
  if (m.length === 3 && MON[m[0]] !== undefined) return new Date(Date.UTC(+m[2], MON[m[0]], +m[1])).toISOString().slice(0, 10);
  return undefined;
}
const mins = (b) => Math.max(1, Math.round(String(b || "").split(/\s+/).length / 220));

const CSS = `@font-face{font-family:"Geist";src:url(/assets/fonts/Geist.woff2) format("woff2");font-weight:100 900;font-display:swap}
@font-face{font-family:"Geist Mono";src:url(/assets/fonts/GeistMono.woff2) format("woff2");font-weight:100 900;font-display:swap}
:root{color-scheme:light dark;--bg:#fff;--fg:#0a0a0a;--mut:#666;--dim:#9e9e9e;--ln:#dadada;--sans:"Geist","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--bg:#0a0a0a;--fg:#f4f4f4;--mut:#9a9a9a;--dim:#5c5c5c;--ln:#2a2a2a}}
*{box-sizing:border-box}::selection{background:var(--fg);color:var(--bg)}
body{margin:0;background:var(--bg);color:var(--fg);font:400 17px/28px var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
header{display:flex;align-items:center;height:40px;padding:0 24px;border-bottom:1px solid var(--ln)}
nav{display:flex;align-items:center;gap:24px;width:100%}
nav a{color:var(--fg);text-decoration:none;font:500 11px/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
nav a:first-child{font:500 13px/1 var(--sans);letter-spacing:-.005em;text-transform:none;color:var(--fg);margin-right:auto}
nav a:hover{color:var(--fg);text-decoration:underline;text-underline-offset:4px}
main{max-width:1000px;margin:0 auto;padding:72px 24px 120px}
h1{max-width:18ch;margin:0 0 24px;font:500 clamp(36px,7.2vw,76px)/.98 var(--sans);letter-spacing:-.05em;text-wrap:balance}
h2,h3{max-width:62ch;font-family:var(--sans);font-weight:500;letter-spacing:-.025em;text-wrap:balance}
h2{margin:56px 0 12px;font-size:28px;line-height:32px}h3{margin:40px 0 8px;font-size:20px;line-height:28px;letter-spacing:-.015em}
p,ul,ol,blockquote{max-width:62ch}p{margin:0 0 20px}
.meta{font:500 11px/16px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.lead{max-width:44ch;margin:0 0 32px;font-size:21px;line-height:30px;color:var(--mut);letter-spacing:-.01em}
blockquote{max-width:600px;margin:44px 0;padding:16px 0 0;border-top:1px solid var(--fg);font:500 clamp(22px,3.4vw,28px)/1.2 var(--sans);letter-spacing:-.025em}
blockquote p{margin:0}
a{color:var(--fg);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px}a:hover{text-decoration-thickness:2px}
strong{font-weight:500}hr{max-width:62ch;margin:32px 0;border:0;border-top:1px solid var(--ln)}
li{margin:6px 0}li::marker{color:var(--dim);font-family:var(--mono);font-size:13px}
ol.l{max-width:none;margin:48px 0 0;padding:0;list-style:none;border-top:1px solid var(--fg)}
ol.l li{margin:0;padding:28px 0;border-bottom:1px solid var(--ln)}
ol.l a{display:block;max-width:32ch;font:500 clamp(24px,3.6vw,34px)/1.08 var(--sans);letter-spacing:-.035em;text-decoration:none;text-wrap:balance}
ol.l a:hover{text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:6px}
ol.l p{margin:12px 0 14px;max-width:56ch;color:var(--mut);font-size:16px;line-height:24px}`;

function page({ title, desc, path, body, ld, type = "website" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${SITE}${path}">
<meta name="twitter:card" content="summary"><meta name="color-scheme" content="light dark"><link rel="preload" href="/assets/fonts/Geist.woff2" as="font" type="font/woff2" crossorigin><style>${CSS}</style>${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}</head>
<body><header><nav><a href="/">${NAME}</a><a href="/journal">Journal</a></nav></header><main>${body}</main></body></html>`;
}
const html = (statusCode, b) => ({ statusCode, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" }, body: b });

export const handler = async (event) => {
  try {
    connectLambda(event);
    const posts = (await loadPosts(getStore("site-content"))).filter((p) => !p.draft);
    const slug = decodeURIComponent(event.queryStringParameters?.slug || "").replace(/\/+$/, "");
    if (!slug) {
      const body = `<h1>Journal</h1><p class="lead">Notes on branding, design, and working with AI. Written as I learn, and updated when I'm wrong.</p>
<ol class="l">${posts.map((p) => `<li><a href="/journal/${esc(p.slug)}">${esc(p.title)}</a><p>${esc(p.excerpt)}</p><span class="meta">${esc(p.date)} · ${mins(p.body)} min read</span></li>`).join("")}</ol>`;
      return html(200, page({ title: `Journal — ${NAME}`, desc: "Notes on branding, design, and working with AI.", path: "/journal", body,
        ld: { "@context": "https://schema.org", "@type": "Blog", name: `Journal — ${NAME}`, url: `${SITE}/journal`, author: { "@type": "Person", name: NAME } } }));
    }
    const p = posts.find((x) => x.slug === slug);
    if (!p) return html(404, page({ title: `Not found — ${NAME}`, desc: "Article not found.", path: `/journal/${slug}`, body: `<h1>Article not found</h1><p><a href="/journal">See all articles</a></p>` }));
    const body = `<article><p class="meta">${esc(p.date)} · ${mins(p.body)} min read · ${NAME}</p><h1>${esc(p.title)}</h1><p class="lead">${esc(p.excerpt)}</p><hr>${md(p.body)}
${p.url ? `<p><a href="${esc(p.url)}" rel="noopener">Also on ${esc(p.source || "the original")}</a></p>` : ""}<hr><p><a href="/journal">All articles</a> · <a href="${SITE}/">Open the full site</a></p></article>`;
    const ld = { "@context": "https://schema.org", "@type": "Article", headline: p.title, description: p.excerpt, datePublished: iso(p.date),
      author: { "@type": "Person", name: NAME, url: SITE }, mainEntityOfPage: `${SITE}/journal/${p.slug}`, ...(p.tag ? { articleSection: p.tag } : {}) };
    return html(200, page({ title: `${p.title} — ${NAME}`, desc: p.excerpt, path: `/journal/${p.slug}`, body, ld, type: "article" }));
  } catch (e) {
    return html(500, page({ title: "Error", desc: "", path: "/journal", body: `<h1>Something went wrong</h1><p>Please try again.</p>` }));
  }
};
