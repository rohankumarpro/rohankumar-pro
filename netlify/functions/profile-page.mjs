// /about and /resume  Server-rendered profile and resume so Google and AI tools can read them.
// Text comes from what the owner saved in Settings, falling back to the starter text in index.html.
// While that text is still the starter placeholder, the pages are marked noindex and left out of the sitemap.
import { connectLambda } from "@netlify/blobs";
import { readFileSync } from "node:fs";
import { contentStore } from "../lib/store.mjs";

const SITE = "https://rohankumar.pro";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const url = (u) => (/^https?:\/\//.test(u) ? esc(u) : "");

function defaults() {
  try {
    const src = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
    const a = src.indexOf("const P = {"), b = src.indexOf("\nconst PROJECTS", a);
    return new Function(`${src.slice(a, b)}; return P;`)();
  } catch {
    try {
      const src = readFileSync(`${process.env.LAMBDA_TASK_ROOT || "."}/index.html`, "utf8");
      const a = src.indexOf("const P = {"), b = src.indexOf("\nconst PROJECTS", a);
      return new Function(`${src.slice(a, b)}; return P;`)();
    } catch { return null; }
  }
}

export const PLACEHOLDER = /This is a short intro|Role title|Degree — University|yourname\.com|Project one/;
const arr = (v, d) => (Array.isArray(v) ? v : d || []);

export async function loadProfile(event) {
  let s = null;
  try { connectLambda(event); s = await contentStore(event).get("settings", { type: "json" }); } catch {}
  s = s || {};
  const D = defaults() || { name: "Rohan Kumar", role: "Brand Designer", bio: "", skills: [], experience: [], links: [], music: {} };
  const p = {
    name: s.name || D.name, role: s.role || D.role, status: s.status || D.status, now: s.now || D.now,
    bio: s.bio || D.bio, email: s.email || D.email, booking: s.booking || D.booking,
    skills: arr(s.skills, D.skills), experience: arr(s.experience, D.experience), links: arr(s.links, D.links),
  };
  const text = [p.bio, p.email, ...p.experience.map((e) => e.title)].join(" ");
  p.placeholder = PLACEHOLDER.test(text);
  return p;
}

const CSS = `:root{color-scheme:light dark;--bg:#fbfaf7;--fg:#1c1b19;--mut:#6b6860;--ln:#e4e1d9;--ac:#1a7f4b}
@media(prefers-color-scheme:dark){:root{--bg:#161614;--fg:#eceae4;--mut:#9a978e;--ln:#2d2c28;--ac:#5fd39a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:18px/1.7 Georgia,'Times New Roman',serif}
main{max-width:700px;margin:0 auto;padding:32px 20px 80px}nav{font:15px system-ui,sans-serif;margin-bottom:32px}
nav a{color:var(--mut);text-decoration:none;margin-right:16px}nav a:hover{color:var(--ac)}
h1{font:700 2rem/1.2 system-ui,sans-serif;margin:.2em 0 .4em}h2{font-family:system-ui,sans-serif;margin-top:1.8em}
.lead{font-size:1.15rem;color:var(--mut)}a{color:var(--ac)}ul.s{list-style:none;padding:0;display:flex;flex-wrap:wrap;gap:8px}
ul.s li{border:1px solid var(--ln);border-radius:99px;padding:2px 14px;font:15px system-ui,sans-serif}
.job{padding:16px 0;border-bottom:1px solid var(--ln)}.job h3{font:600 1.1rem system-ui,sans-serif;margin:0}.job small{font:14px system-ui,sans-serif;color:var(--mut)}.job p{margin:.4em 0 0}`;

function layout({ title, desc, path, body, ld, noindex, name }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${SITE}${path}">${noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="profile"><meta property="og:url" content="${SITE}${path}">
<meta name="twitter:card" content="summary"><style>${CSS}</style><script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script></head>
<body><main><nav><a href="/">${esc(name)}</a><a href="/about">About</a><a href="/resume">Resume</a><a href="/journal">Journal</a></nav>${body}</main></body></html>`;
}

export const handler = async (event) => {
  const which = event.queryStringParameters?.page === "resume" ? "resume" : "about";
  const p = await loadProfile(event);
  const person = {
    "@type": "Person", name: p.name, jobTitle: p.role, url: `${SITE}/`,
    ...(p.skills.length ? { knowsAbout: p.skills } : {}),
    sameAs: p.links.map((l) => l.url).filter((u) => /^https?:\/\//.test(u)),
  };
  let page;
  if (which === "about") {
    const body = `<h1>${esc(p.name)}</h1><p class="lead">${esc(p.role)}${p.status ? ` · ${esc(p.status)}` : ""}</p><p>${esc(p.bio)}</p>
${p.now ? `<h2>Right now</h2><p>${esc(p.now)}</p>` : ""}${p.skills.length ? `<h2>What I work with</h2><ul class="s">${p.skills.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<h2>Get in touch</h2><p>${url(p.booking) ? `<a href="${url(p.booking)}">Book a call</a>` : ""}${/yourname\.com/.test(p.email || "") || !p.email ? "" : ` · <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`}</p>
${p.links.length ? `<p>${p.links.filter((l) => url(l.url)).map((l) => `<a href="${url(l.url)}" rel="me noopener">${esc(l.label)}</a>`).join(" · ")}</p>` : ""}
<p><a href="/resume">Resume</a> · <a href="/journal">Journal</a> · <a href="/">Open the full site</a></p>`;
    page = { title: `About ${p.name} — ${p.role}`, desc: String(p.bio).slice(0, 160), path: "/about", body,
      ld: { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: person } };
  } else {
    const body = `<h1>Resume — ${esc(p.name)}</h1><p class="lead">${esc(p.role)}</p>
${p.experience.map((e) => `<div class="job"><h3>${esc(e.title)}</h3><small>${esc(e.time)}</small><p>${esc(e.text)}</p></div>`).join("")}
${p.skills.length ? `<h2>Skills</h2><ul class="s">${p.skills.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
<p><a href="/about">About</a> · <a href="/">Open the full site</a></p>`;
    page = { title: `Resume — ${p.name}`, desc: `${p.name}, ${p.role}. Experience, education and skills.`, path: "/resume", body,
      ld: { "@context": "https://schema.org", "@type": "ProfilePage", mainEntity: person } };
  }
  return {
    statusCode: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" },
    body: layout({ ...page, noindex: p.placeholder, name: p.name }),
  };
};
