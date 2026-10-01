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

const CSS = `:root{color-scheme:light dark;--bg:#fbfaf7;--fg:#1c1b19;--mut:#6b6860;--ln:#e4e1d9;--ac:#1a7f4b}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--fg:#eceae4;--mut:#9a978e;--ln:#2d2c28;--ac:#5fd39a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.7 Georgia,'Times New Roman',serif}
main{max-width:700px;margin:0 auto;padding:32px 20px 80px}nav{font:15px system-ui,sans-serif;margin-bottom:32px}
nav a{color:var(--mut);text-decoration:none;margin-right:16px}nav a:hover{color:var(--ac)}
h1{font:700 2rem/1.2 system-ui,sans-serif;margin:.2em 0 .4em}h2,h3{font-family:system-ui,sans-serif;line-height:1.3;margin-top:1.8em}
.meta{font:14px system-ui,sans-serif;color:var(--mut)}.lead{font-size:1.15rem;color:var(--mut)}
blockquote{margin:1.4em 0;padding:.2em 1.1em;border-left:3px solid var(--ac);color:var(--mut)}
a{color:var(--ac)}hr{border:0;border-top:1px solid var(--ln);margin:1.6em 0}
ol.l{list-style:none;padding:0}ol.l li{padding:18px 0;border-bottom:1px solid var(--ln)}
ol.l a{font:600 1.15rem system-ui,sans-serif;text-decoration:none;color:var(--fg)}ol.l p{margin:.3em 0;color:var(--mut);font-size:1rem}`;

function page({ title, desc, path, body, ld, type = "website" }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="${type}"><meta property="og:url" content="${SITE}${path}">
<meta name="twitter:card" content="summary"><style>${CSS}</style>${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}</head>
<body><main><nav><a href="/">${NAME}</a><a href="/journal">Journal</a></nav>${body}</main></body></html>`;
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
