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
:root{color-scheme:light dark;--bg:#fff;--fg:#0a0a0a;--mut:#6a6a6a;--dim:#a3a3a3;--soft:#f3f3f3;--soft2:#e8e8e8;--sans:"Geist","Helvetica Neue",Helvetica,Arial,system-ui,sans-serif;--mono:"Geist Mono",ui-monospace,Menlo,monospace}
@media(prefers-color-scheme:dark){:root{--bg:#0b0b0b;--fg:#f5f5f5;--mut:#a2a2a2;--dim:#626262;--soft:#161616;--soft2:#202020}}
*{box-sizing:border-box}::selection{background:var(--fg);color:var(--bg)}
body{margin:0;background:var(--bg);color:var(--fg);font:400 17px/30px var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
header{display:flex;align-items:center;height:64px;padding:0 28px}
nav{display:flex;align-items:center;gap:8px;width:100%}
nav a{padding:9px 16px;border-radius:999px;color:var(--mut);text-decoration:none;font:600 13px/1 var(--sans);transition:background .16s,color .16s}
nav a:first-child{margin:0 auto 0 -16px;color:var(--fg);font-size:14px}
nav a:hover{background:var(--soft);color:var(--fg)}
main{max-width:1040px;margin:0 auto;padding:88px 28px 140px}
h1{max-width:16ch;margin:0 0 28px;font:700 clamp(40px,7.6vw,84px)/.96 var(--sans);letter-spacing:-.055em;text-wrap:balance}
h2,h3{max-width:62ch;font-family:var(--sans);font-weight:700;letter-spacing:-.035em;text-wrap:balance}
h2{margin:72px 0 14px;font-size:30px;line-height:34px}h3{margin:44px 0 10px;font-size:20px;line-height:28px;letter-spacing:-.02em}
p,ul,ol,blockquote{max-width:62ch}p{margin:0 0 22px}
.meta{font:500 11px/16px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.lead{max-width:44ch;margin:0 0 40px;font-size:22px;line-height:33px;font-weight:500;color:var(--mut);letter-spacing:-.015em}
blockquote{max-width:620px;margin:52px 0;padding:40px 44px;border-radius:28px;background:var(--soft);font:700 clamp(22px,3.4vw,30px)/1.2 var(--sans);letter-spacing:-.035em}
blockquote p{margin:0}
a{color:var(--fg);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px}a:hover{text-decoration-thickness:2px}
strong{font-weight:600}hr{display:none}
li{margin:8px 0}li::marker{color:var(--dim);font-family:var(--mono);font-size:13px}
ol.l{max-width:none;margin:56px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
ol.l li{margin:0 -28px;padding:32px 28px;border-radius:28px;transition:background .3s cubic-bezier(.16,1,.3,1)}
ol.l li:hover{background:var(--soft)}
ol.l a{display:block;max-width:30ch;font:700 clamp(26px,3.8vw,38px)/1.05 var(--sans);letter-spacing:-.045em;text-decoration:none;text-wrap:balance}
ol.l p{margin:14px 0 16px;max-width:54ch;color:var(--mut);font-size:16px;line-height:26px}
@media(max-width:640px){header{padding:0 16px}main{padding:56px 20px 100px}ol.l li{margin:0 -20px;padding:26px 20px}}`;

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
